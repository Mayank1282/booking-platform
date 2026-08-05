<?php

namespace App\Exceptions;

use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * A rule of the booking domain was violated (slot taken, illegal status change,
 * cancellation window passed). Renders as a clean 422 rather than a 500.
 */
class BookingException extends Exception
{
    public function __construct(string $message, private readonly int $status = 422)
    {
        parent::__construct($message);
    }

    public static function slotUnavailable(): self
    {
        return new self('That time slot is no longer available. Please pick another.');
    }

    public static function invalidTransition(string $from, string $to): self
    {
        return new self("A {$from} booking cannot be marked as {$to}.");
    }

    public function render(Request $request): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $this->getMessage(),
            'data' => null,
        ], $this->status);
    }
}
