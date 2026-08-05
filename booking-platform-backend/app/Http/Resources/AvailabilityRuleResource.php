<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AvailabilityRuleResource extends JsonResource
{
    private const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'day_of_week' => $this->day_of_week,
            'day_label' => self::DAYS[$this->day_of_week] ?? 'Unknown',
            'start_time' => $this->startTimeShort(),
            'end_time' => $this->endTimeShort(),
            'is_active' => $this->is_active,
        ];
    }
}
