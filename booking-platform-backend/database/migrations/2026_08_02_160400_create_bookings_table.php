<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bookings', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique(); // BKG-000123
            $table->foreignId('client_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('provider_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('service_id')->constrained()->restrictOnDelete();

            $table->dateTime('starts_at');
            $table->dateTime('ends_at');
            $table->unsignedSmallInteger('duration_minutes');

            // Price is snapshotted at booking time so later service edits
            // never rewrite the history of what a client actually agreed to pay.
            $table->decimal('price_amount', 10, 2);
            $table->string('currency', 3)->default('INR');

            // pending | confirmed | completed | cancelled
            $table->string('status')->default('pending')->index();
            $table->text('notes')->nullable();

            $table->timestamp('confirmed_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('cancellation_reason')->nullable();

            $table->timestamps();

            // Overlap detection queries hit these hard.
            $table->index(['provider_id', 'starts_at', 'ends_at']);
            $table->index(['client_id', 'starts_at']);
            $table->index(['service_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bookings');
    }
};
