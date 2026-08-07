<?php

namespace App\Support;

use Illuminate\Contracts\Support\Arrayable;

/**
 * The single place money is divided. Nothing else in the app does this
 * arithmetic; everything reads these four figures.
 *
 * A booking splits three ways:
 *
 *   provider   what the provider named and receives, untouched
 *   commission the platform's cut, added on top
 *   processing Stripe's cut plus currency conversion, passed through
 *   ---------- +
 *   total      what the client is charged
 *
 * Processing is quoted separately and retained on a refund, because Stripe
 * keeps its fee when a charge is reversed. Bundling it into the commission
 * would mean every cancellation cost the platform real money for a service
 * nobody received; charging it to the client keeps both the provider and the
 * platform whole either way.
 *
 * Everything is computed in minor units (paise, cents) as integers. Money in
 * floats drifts — 800 * 1.1 is not reliably 880.00 — and a fee a hundredth of
 * a rupee out is a transfer Stripe rejects. The invariant
 * `provider + commission + processing === total` therefore holds by
 * construction: the total is a sum, never a separate calculation.
 */
final class Pricing implements Arrayable
{
    private function __construct(
        public readonly int $providerMinor,
        public readonly int $platformFeeMinor,
        public readonly int $processingFeeMinor,
        public readonly string $currency,
        public readonly int $feeBps,
    ) {}

    /**
     * Builds the split from the amount the provider set on their service.
     *
     * @param  float|string  $providerAmount  major units, e.g. 800.00
     */
    public static function fromProviderAmount(
        float|string $providerAmount,
        ?string $currency = null,
        ?int $feeBps = null,
    ): self {
        $currency = strtolower($currency ?? (string) config('booking.payments.currency', 'inr'));
        $feeBps ??= (int) config('booking.payments.platform_fee_bps', 1000);

        $providerMinor = self::toMinor((float) $providerAmount, $currency);

        // Basis points keep a fractional rate exact: 10% is 1000 bps and 2.5%
        // is 250, with no decimal to round on the way in.
        $platformFeeMinor = (int) round($providerMinor * $feeBps / 10000);

        /*
         * No processing here, deliberately.
         *
         * What processing costs depends on *how* the client chooses to pay,
         * and they have not chosen yet. Stripe settles this platform in USD,
         * so an INR booking carries a card fee and a conversion; Razorpay
         * settles INR natively and the commission absorbs its fee. Baking a
         * gateway's cost into the booking would quote every client the more
         * expensive of the two before they had picked either.
         *
         * So a booking is worth provider + commission everywhere, and
         * `withProcessingFor()` adds the gateway's cost at checkout.
         */
        return new self(
            providerMinor: $providerMinor,
            platformFeeMinor: $platformFeeMinor,
            processingFeeMinor: 0,
            currency: $currency,
            feeBps: $feeBps,
        );
    }

    /**
     * The same booking, priced for a particular gateway.
     *
     * Gateways that pass their cost on to the client gain a processing line;
     * the rest return the booking price unchanged.
     */
    public function withProcessingFor(string $gateway): self
    {
        $config = (array) config("booking.payments.gateways.{$gateway}", []);

        if (! ($config['passes_processing_to_client'] ?? false)) {
            return $this;
        }

        $bps = (int) config('booking.payments.processing_fee_bps', 0);
        $fixed = self::toMinor((float) config('booking.payments.processing_fee_fixed', 0), $this->currency);

        // Charged on what the client actually pays, which is what a card
        // processor's percentage applies to — so on provider + commission.
        $processing = $bps > 0 || $fixed > 0
            ? (int) round(($this->providerMinor + $this->platformFeeMinor) * $bps / 10000) + $fixed
            : 0;

        return new self(
            providerMinor: $this->providerMinor,
            platformFeeMinor: $this->platformFeeMinor,
            processingFeeMinor: $processing,
            currency: $this->currency,
            feeBps: $this->feeBps,
        );
    }

    /**
     * Rebuilds a split that was already agreed and stored, rather than
     * recomputing it. A booking is priced once; if the commission or Stripe's
     * rates change next month, an appointment booked today must still settle
     * on the terms the client accepted.
     */
    public static function fromStored(
        float|string $providerAmount,
        float|string $platformFee,
        float|string $processingFee,
        string $currency,
        ?int $feeBps = null,
    ): self {
        $currency = strtolower($currency);

        return new self(
            providerMinor: self::toMinor((float) $providerAmount, $currency),
            platformFeeMinor: self::toMinor((float) $platformFee, $currency),
            processingFeeMinor: self::toMinor((float) $processingFee, $currency),
            currency: $currency,
            feeBps: $feeBps ?? (int) config('booking.payments.platform_fee_bps', 1000),
        );
    }

    // --- Derived totals ----------------------------------------------------

    /** What the client is charged, in minor units. A sum, never a formula. */
    public function totalMinor(): int
    {
        return $this->providerMinor + $this->platformFeeMinor + $this->processingFeeMinor;
    }

    /**
     * What Stripe is told to hold back from the transfer: the commission plus
     * the processing pass-through.
     *
     * Stripe deducts its real fee from the platform balance, so the platform
     * receives this and pays that out — netting roughly the commission alone.
     * The provider is untouched by any of it.
     */
    public function applicationFeeMinor(): int
    {
        return $this->platformFeeMinor + $this->processingFeeMinor;
    }

    /**
     * What a cancellation returns to the client: their money back except the
     * processing they have already cost us. Reversing this leaves the provider
     * and the platform both level.
     */
    public function refundableMinor(): int
    {
        return $this->providerMinor + $this->platformFeeMinor;
    }

    // --- Major-unit views, for storing and displaying -----------------------

    public function providerAmount(): float
    {
        return self::toMajor($this->providerMinor, $this->currency);
    }

    public function platformFee(): float
    {
        return self::toMajor($this->platformFeeMinor, $this->currency);
    }

    public function processingFee(): float
    {
        return self::toMajor($this->processingFeeMinor, $this->currency);
    }

    public function total(): float
    {
        return self::toMajor($this->totalMinor(), $this->currency);
    }

    public function refundable(): float
    {
        return self::toMajor($this->refundableMinor(), $this->currency);
    }

    /** The commission as a percentage, for display: 1000 bps -> 10.0. */
    public function feePercent(): float
    {
        return $this->feeBps / 100;
    }

    public function toArray(): array
    {
        return [
            'provider_amount' => $this->providerAmount(),
            'platform_fee' => $this->platformFee(),
            'processing_fee' => $this->processingFee(),
            'total' => $this->total(),
            'refundable' => $this->refundable(),
            'currency' => strtoupper($this->currency),
            'fee_percent' => $this->feePercent(),
        ];
    }

    // --- Minor-unit conversion ---------------------------------------------

    /** Stripe wants the smallest unit — paise for INR, cents for USD. */
    public static function toMinor(float $amount, string $currency): int
    {
        return self::isZeroDecimal($currency) ? (int) round($amount) : (int) round($amount * 100);
    }

    public static function toMajor(int $minor, string $currency): float
    {
        return self::isZeroDecimal($currency) ? (float) $minor : $minor / 100;
    }

    private static function isZeroDecimal(string $currency): bool
    {
        return in_array(
            strtolower($currency),
            (array) config('booking.payments.zero_decimal_currencies', []),
            true
        );
    }
}
