<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['provider_id', 'day_of_week', 'start_time', 'end_time', 'is_active'])]
class AvailabilityRule extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'day_of_week' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function provider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'provider_id');
    }

    #[Scope]
    protected function active(Builder $query): void
    {
        $query->where('is_active', true);
    }

    /** 'HH:MM' regardless of whether the driver returns 'HH:MM:SS'. */
    public function startTimeShort(): string
    {
        return substr((string) $this->start_time, 0, 5);
    }

    public function endTimeShort(): string
    {
        return substr((string) $this->end_time, 0, 5);
    }
}
