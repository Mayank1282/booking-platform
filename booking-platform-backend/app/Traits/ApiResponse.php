<?php

namespace App\Traits;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Pagination\AbstractPaginator;

/**
 * Every endpoint answers with the same envelope: { success, message, data }.
 * Paginated responses add a `meta` block alongside it.
 */
trait ApiResponse
{
    protected function ok(mixed $data = null, string $message = 'OK', int $status = 200): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $data,
        ], $status);
    }

    protected function created(mixed $data = null, string $message = 'Created'): JsonResponse
    {
        return $this->ok($data, $message, 201);
    }

    protected function fail(string $message = 'Something went wrong', int $status = 400, mixed $errors = null): JsonResponse
    {
        $body = [
            'success' => false,
            'message' => $message,
            'data' => null,
        ];

        if ($errors !== null) {
            $body['errors'] = $errors;
        }

        return response()->json($body, $status);
    }

    /**
     * Wrap a paginated resource collection, lifting Laravel's pagination
     * details into a flat `meta` block the frontend can read directly.
     */
    protected function paginated(ResourceCollection $collection, string $message = 'OK'): JsonResponse
    {
        $paginator = $collection->resource;

        $meta = $paginator instanceof AbstractPaginator ? [
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
            'from' => $paginator->firstItem(),
            'to' => $paginator->lastItem(),
        ] : null;

        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $collection->resolve(),
            'meta' => $meta,
        ]);
    }
}
