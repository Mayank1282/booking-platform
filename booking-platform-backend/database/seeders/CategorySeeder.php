<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;

class CategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            ['name' => 'Wellness & Spa', 'slug' => 'wellness-spa', 'icon' => 'flower-2', 'description' => 'Massage, therapy and recovery sessions.'],
            ['name' => 'Hair & Beauty', 'slug' => 'hair-beauty', 'icon' => 'scissors', 'description' => 'Cuts, colour, styling and grooming.'],
            ['name' => 'Fitness & Training', 'slug' => 'fitness-training', 'icon' => 'dumbbell', 'description' => 'Personal training, yoga and coaching.'],
            ['name' => 'Home Services', 'slug' => 'home-services', 'icon' => 'house', 'description' => 'Repairs, cleaning and installation.'],
            ['name' => 'Photography', 'slug' => 'photography', 'icon' => 'camera', 'description' => 'Portraits, events and product shoots.'],
            ['name' => 'Consulting', 'slug' => 'consulting', 'icon' => 'briefcase', 'description' => 'Legal, financial and business advice.'],
            ['name' => 'Tutoring', 'slug' => 'tutoring', 'icon' => 'graduation-cap', 'description' => 'Academic and skill-based lessons.'],
            ['name' => 'Automotive', 'slug' => 'automotive', 'icon' => 'car', 'description' => 'Servicing, detailing and inspection.'],
        ];

        foreach ($categories as $category) {
            Category::updateOrCreate(['slug' => $category['slug']], $category);
        }
    }
}
