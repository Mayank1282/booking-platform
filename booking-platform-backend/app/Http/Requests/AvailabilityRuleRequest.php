<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AvailabilityRuleRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'rules' => ['present', 'array', 'max:40'],
            'rules.*.day_of_week' => ['required', 'integer', 'between:0,6'],
            'rules.*.start_time' => ['required', 'date_format:H:i'],
            'rules.*.end_time' => ['required', 'date_format:H:i', 'after:rules.*.start_time'],
            'rules.*.is_active' => ['boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'rules.*.end_time.after' => 'Each window must end after it starts.',
        ];
    }
}
