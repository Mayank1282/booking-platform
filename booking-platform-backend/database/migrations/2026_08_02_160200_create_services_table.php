<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('services', function (Blueprint $table) {
            $table->id();
            $table->foreignId('provider_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('category_id')->constrained()->restrictOnDelete();

            $table->string('title');
            $table->string('slug')->unique();
            $table->text('description');
            $table->string('image_path')->nullable();

            $table->unsignedSmallInteger('duration_minutes')->default(60);
            $table->unsignedSmallInteger('buffer_minutes')->default(0);
            $table->decimal('price', 10, 2);
            $table->string('currency', 3)->default('INR');

            // remote | on_site (at the provider's address) | client_location
            $table->string('location_type')->default('on_site')->index();

            $table->decimal('rating_avg', 3, 2)->default(0);
            $table->unsignedInteger('rating_count')->default(0);
            $table->unsignedInteger('bookings_count')->default(0);

            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();

            $table->index(['category_id', 'is_active']);
            $table->index(['provider_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('services');
    }
};
