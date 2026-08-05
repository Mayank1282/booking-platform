<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->foreignId('client_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('provider_id')->constrained('users')->cascadeOnDelete();

            $table->decimal('amount', 10, 2);
            $table->string('currency', 3)->default('INR');

            // pending | processing | succeeded | failed | refunded
            $table->string('status')->default('pending')->index();
            $table->string('gateway')->default('simulated'); // stripe | simulated

            $table->string('reference')->nullable()->index();       // PaymentIntent id
            $table->string('client_secret')->nullable();
            $table->string('receipt_url')->nullable();
            $table->string('failure_reason')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('refunded_at')->nullable();
            $table->json('meta')->nullable();

            $table->timestamps();

            $table->index(['provider_id', 'status']);
        });

        // Stripe delivers webhooks at-least-once. Recording the event id makes
        // handling idempotent — a replayed event is recognised and skipped.
        Schema::create('webhook_events', function (Blueprint $table) {
            $table->id();
            $table->string('event_id')->unique();
            $table->string('type')->index();
            $table->json('payload')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('webhook_events');
        Schema::dropIfExists('payments');
    }
};
