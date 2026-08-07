<?php

use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AvailabilityController;
use App\Http\Controllers\Api\BookingController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\PayoutController;
use App\Http\Controllers\Api\RazorpayWebhookController;
use App\Http\Controllers\Api\ReviewController;
use App\Http\Controllers\Api\SearchController;
use App\Http\Controllers\Api\ServiceController;
use App\Http\Controllers\Api\StripeWebhookController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public
|--------------------------------------------------------------------------
*/

Route::post('/auth/register', [AuthController::class, 'register'])->middleware('throttle:10,1');
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:5,1');
Route::post('/auth/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:5,1');

Route::get('/categories', [CategoryController::class, 'index']);

// Typeahead for the marketplace search box.
Route::get('/search/suggestions', [SearchController::class, 'suggestions']);

Route::get('/services', [ServiceController::class, 'index']);
Route::get('/services/{service}', [ServiceController::class, 'show']);
Route::get('/services/{service}/reviews', [ServiceController::class, 'reviews']);
Route::get('/services/{service}/availability', [AvailabilityController::class, 'slots']);
Route::get('/services/{service}/availability/month', [AvailabilityController::class, 'month']);

// Authenticated by Stripe's signature header rather than a session token.
Route::post('/webhooks/stripe', [StripeWebhookController::class, 'handle']);
Route::post('/webhooks/razorpay', [RazorpayWebhookController::class, 'handle']);

/*
|--------------------------------------------------------------------------
| Authenticated
|--------------------------------------------------------------------------
*/

// `not.suspended` re-checks the account on every request, so a token issued
// before a suspension stops working the moment the suspension lands.
Route::middleware(['auth:sanctum', 'not.suspended'])->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::post('/auth/profile', [AuthController::class, 'updateProfile']); // POST so it accepts multipart avatars
    Route::post('/auth/password', [AuthController::class, 'changePassword']);

    Route::get('/dashboard', [DashboardController::class, 'index']);

    // Both roles read bookings; the mutating actions are role-gated below.
    Route::get('/bookings', [BookingController::class, 'index']);
    Route::get('/bookings/{booking}', [BookingController::class, 'show']);
    Route::post('/bookings/{booking}/cancel', [BookingController::class, 'cancel']);

    Route::get('/payments', [PaymentController::class, 'index']);

    /*
     * Client-only
     */
    Route::middleware('role:client')->group(function () {
        Route::post('/bookings', [BookingController::class, 'store']);
        Route::get('/bookings/{booking}/pay/gateways', [PaymentController::class, 'gateways']);
        Route::post('/bookings/{booking}/pay', [PaymentController::class, 'createIntent']);
        Route::post('/bookings/{booking}/pay/razorpay', [PaymentController::class, 'confirmRazorpay']);
        Route::post('/bookings/{booking}/pay/simulate', [PaymentController::class, 'simulate']);
        Route::get('/bookings/{booking}/pay/status', [PaymentController::class, 'syncStatus']);
        Route::post('/bookings/{booking}/review', [ReviewController::class, 'store']);
    });

    /*
     * Provider-only
     */
    Route::middleware('role:provider')->prefix('provider')->group(function () {
        Route::get('/services', [ServiceController::class, 'mine']);
        Route::get('/services/{service}', [ServiceController::class, 'showMine']);
        Route::post('/services', [ServiceController::class, 'store']);
        Route::post('/services/{service}', [ServiceController::class, 'update']); // POST for multipart image uploads
        Route::delete('/services/{service}', [ServiceController::class, 'destroy']);

        // Where this provider's share of each booking is paid out.
        Route::get('/payouts', [PayoutController::class, 'show']);
        Route::post('/payouts/onboarding', [PayoutController::class, 'onboarding']);
        Route::post('/payouts/dashboard', [PayoutController::class, 'dashboard']);

        Route::get('/availability/rules', [AvailabilityController::class, 'rules']);
        Route::put('/availability/rules', [AvailabilityController::class, 'saveRules']);
        Route::get('/availability/blocks', [AvailabilityController::class, 'blocks']);
        Route::post('/availability/blocks', [AvailabilityController::class, 'storeBlock']);
        Route::delete('/availability/blocks/{block}', [AvailabilityController::class, 'destroyBlock']);

        Route::post('/bookings/{booking}/confirm', [BookingController::class, 'confirm']);
        Route::post('/bookings/{booking}/complete', [BookingController::class, 'complete']);

        Route::get('/reviews', [ReviewController::class, 'received']);
    });

    /*
     * Admin only. The admin role is never self-assignable at registration —
     * it is granted by seeding or by promoting an account directly.
     */
    Route::middleware('role:admin')->prefix('admin')->group(function () {
        Route::get('/overview', [AdminController::class, 'overview']);

        Route::get('/users', [AdminController::class, 'users']);
        Route::post('/users/{user}/suspend', [AdminController::class, 'suspend']);
        Route::post('/users/{user}/reinstate', [AdminController::class, 'reinstate']);
        Route::delete('/users/{user}', [AdminController::class, 'erase']);

        Route::get('/services', [AdminController::class, 'services']);
        Route::post('/services/{service}/toggle', [AdminController::class, 'toggleService']);

        Route::get('/bookings', [AdminController::class, 'bookings']);
        Route::get('/payments', [AdminController::class, 'payments']);
    });
});
