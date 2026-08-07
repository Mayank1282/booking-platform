<?php

namespace App\Http\Requests;

use App\Enums\LocationType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ServiceRequest extends FormRequest
{
    public function rules(): array
    {
        // Updates come in as POST, not PUT — multipart image uploads need it.
        // Keying off the route parameter rather than the verb is what makes a
        // partial update (toggling `is_active`, say) work.
        $isUpdate = $this->route('service') !== null;

        return [
            'title' => [$isUpdate ? 'sometimes' : 'required', 'string', 'max:150'],
            'description' => [$isUpdate ? 'sometimes' : 'required', 'string', 'max:5000'],
            'category_id' => [$isUpdate ? 'sometimes' : 'required', 'exists:categories,id'],
            'duration_minutes' => [$isUpdate ? 'sometimes' : 'required', 'integer', 'min:15', 'max:480'],
            'buffer_minutes' => ['nullable', 'integer', 'min:0', 'max:120'],
            'price' => [$isUpdate ? 'sometimes' : 'required', 'numeric', 'min:0', 'max:9999999'],
            'location_type' => [$isUpdate ? 'sometimes' : 'required', Rule::enum(LocationType::class)],
            'is_active' => ['boolean'],
            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],

            // Optional per-service address. Blank means "wherever I am",
            // inheriting the provider profile.
            'address_line' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'],
            'state' => ['nullable', 'string', 'max:100'],
            'postal_code' => ['nullable', 'string', 'max:20'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
        ];
    }

    public function messages(): array
    {
        return [
            'duration_minutes.min' => 'A service must run for at least 15 minutes.',
            'image.max' => 'The service image may not be larger than 4 MB.',
        ];
    }
}
