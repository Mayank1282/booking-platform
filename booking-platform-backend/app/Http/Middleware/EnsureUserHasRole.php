<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Route-level role gate: `->middleware('role:provider')`.
 */
class EnsureUserHasRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user || ! in_array($user->role->value, $roles, true)) {
            return response()->json([
                'success' => false,
                'message' => 'This action is only available to '.implode(' or ', $roles).' accounts.',
                'data' => null,
            ], 403);
        }

        return $next($request);
    }
}
