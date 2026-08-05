<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * A token issued before a suspension would otherwise keep working, so every
 * authenticated request re-checks the account rather than trusting the token.
 */
class EnsureUserIsNotSuspended
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user?->isSuspended()) {
            return response()->json([
                'success' => false,
                'message' => $user->suspension_reason
                    ? "This account is suspended: {$user->suspension_reason}"
                    : 'This account has been suspended. Please contact support.',
                'data' => null,
            ], 403);
        }

        return $next($request);
    }
}
