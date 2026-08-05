<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;

class CategoryController extends Controller
{
    use ApiResponse;

    public function index(): JsonResponse
    {
        $categories = Category::query()
            ->active()
            ->withCount(['services' => fn ($q) => $q->where('is_active', true)])
            ->orderBy('name')
            ->get();

        return $this->ok(CategoryResource::collection($categories)->resolve());
    }
}
