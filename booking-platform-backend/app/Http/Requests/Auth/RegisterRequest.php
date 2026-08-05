<?php

namespace App\Http\Requests\Auth;

use App\Enums\UserRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class RegisterRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'confirmed', Password::min(8)],
            // Restricted to the self-assignable roles: nobody can register
            // themselves as an admin by posting role=admin.
            'role' => ['required', Rule::in(UserRole::selfAssignable())],
            'phone' => ['nullable', 'string', 'max:30'],

            // Only meaningful when registering as a provider.
            'business_name' => ['required_if:role,provider', 'nullable', 'string', 'max:150'],
            'city' => ['nullable', 'string', 'max:100'],
        ];
    }

    public function messages(): array
    {
        return [
            'business_name.required_if' => 'Please tell us the name of your business.',
            'role.required' => 'Choose whether you are booking services or offering them.',
        ];
    }
}
