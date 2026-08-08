<?php

namespace Database\Seeders;

use App\Enums\BookingStatus;
use App\Enums\LocationType;
use App\Enums\PaymentStatus;
use App\Enums\UserRole;
use App\Models\Booking;
use App\Models\Category;
use App\Models\Payment;
use App\Models\ProviderProfile;
use App\Models\Review;
use App\Models\Service;
use App\Models\User;
use App\Services\ReviewService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Builds a marketplace that already looks lived-in: providers with real
 * addresses, a spread of services, and bookings across every status so the
 * dashboards, charts and review flows all have something to show.
 */
class DemoSeeder extends Seeder
{
    /** Real coordinates so the Leaflet map has genuine pins to drop. */
    private const CITIES = [
        ['city' => 'Bengaluru', 'state' => 'Karnataka', 'lat' => 12.9716, 'lng' => 77.5946, 'postal' => '560001'],
        ['city' => 'Mumbai', 'state' => 'Maharashtra', 'lat' => 19.0760, 'lng' => 72.8777, 'postal' => '400001'],
        ['city' => 'New Delhi', 'state' => 'Delhi', 'lat' => 28.6139, 'lng' => 77.2090, 'postal' => '110001'],
        ['city' => 'Pune', 'state' => 'Maharashtra', 'lat' => 18.5204, 'lng' => 73.8567, 'postal' => '411001'],
        ['city' => 'Hyderabad', 'state' => 'Telangana', 'lat' => 17.3850, 'lng' => 78.4867, 'postal' => '500001'],
        ['city' => 'Chennai', 'state' => 'Tamil Nadu', 'lat' => 13.0827, 'lng' => 80.2707, 'postal' => '600001'],
    ];

    public function run(): void
    {
        $categories = Category::pluck('id', 'slug');

        $this->createAdmin();

        $providers = $this->createProviders($categories);
        $clients = $this->createClients();

        $this->createBookings($providers, $clients);
    }

    /**
     * The platform administrator. This role is never self-assignable at
     * registration, so it only ever exists by seeding or direct promotion.
     */
    private function createAdmin(): User
    {
        return User::updateOrCreate(
            ['email' => 'admin@yopmail.com'],
            [
                'name' => 'Platform Admin',
                'password' => 'password',
                'role' => UserRole::Admin,
            ]
        );
    }

    /** @return array<int, User> */
    private function createProviders($categories): array
    {
        $definitions = [
            [
                'name' => 'Meera Rao', 'email' => 'provider@yopmail.com',
                'business' => 'Stillpoint Wellness Studio',
                'headline' => 'Therapeutic massage and recovery, ten years in practice.',
                'bio' => 'Stillpoint is a two-room studio focused on deep tissue work, sports recovery and prenatal massage. Every session begins with a short consultation so the pressure and focus match how your body actually feels that day.',
                'city' => 0,
                'address' => '4th Floor, Brigade Road',
                'services' => [
                    ['Deep Tissue Massage', 'wellness-spa', 60, 2400, 15, LocationType::OnSite, 'Sustained pressure through the deeper muscle layers to release chronic tension in the back, shoulders and hips.'],
                    ['Prenatal Massage', 'wellness-spa', 75, 2800, 15, LocationType::OnSite, 'A gentle, side-lying session designed for the second and third trimesters, with bolstering for comfort throughout.'],
                    ['Sports Recovery Session', 'wellness-spa', 45, 1900, 10, LocationType::OnSite, 'Targeted work for athletes between training blocks — trigger point release, stretching and mobility guidance.'],
                ],
            ],
            [
                'name' => 'Arjun Kapoor', 'email' => 'arjun@yopmail.com',
                'business' => 'The Cutting Room',
                'headline' => 'Precision cuts and colour in a small, unhurried salon.',
                'bio' => 'A two-chair salon where appointments are spaced generously so nobody is rushed. Specialising in textured cuts, grey blending and low-maintenance colour.',
                'city' => 1,
                'address' => '12 Hill Road, Bandra West',
                'services' => [
                    ['Signature Haircut & Style', 'hair-beauty', 60, 1500, 15, LocationType::OnSite, 'A consultation-led cut shaped around your hair texture and how you actually style it at home, finished with a blow-dry.'],
                    ['Full Colour & Gloss', 'hair-beauty', 120, 4500, 20, LocationType::OnSite, 'Single-process colour with a finishing gloss for shine and tone control. Includes a strand test on first visits.'],
                    ['Beard Sculpt & Hot Towel', 'hair-beauty', 30, 800, 10, LocationType::OnSite, 'Shape, line-up and a hot towel finish with a conditioning oil.'],
                ],
            ],
            [
                'name' => 'Priya Nair', 'email' => 'priya@yopmail.com',
                'business' => 'Groundwork Strength',
                'headline' => 'Strength coaching for people who have never lifted before.',
                'bio' => 'Certified strength and conditioning coach working with beginners, desk-bound professionals and post-injury clients. Sessions run one-to-one, in person or over video.',
                'city' => 2,
                'address' => 'Block C, Hauz Khas',
                'services' => [
                    ['1:1 Strength Session', 'fitness-training', 60, 1800, 15, LocationType::OnSite, 'A coached barbell and accessory session with technique correction throughout. Programming adjusts week to week.'],
                    ['Online Coaching Call', 'fitness-training', 45, 1200, 0, LocationType::Remote, 'A video call to review your training logs, adjust your programme and work through form footage you send ahead of time.'],
                    ['Movement Assessment', 'fitness-training', 90, 2500, 15, LocationType::OnSite, 'A full screen of mobility, stability and movement patterns, with a written plan you keep afterwards.'],
                ],
            ],
            [
                'name' => 'Rahul Desai', 'email' => 'rahul@yopmail.com',
                'business' => 'Desai Home Care',
                'headline' => 'Electrical, plumbing and appliance work — at your door.',
                'bio' => 'Licensed technicians covering the western suburbs. Fixed call-out pricing, parts quoted before any work begins.',
                'city' => 3,
                'address' => 'Shop 7, Koregaon Park',
                'services' => [
                    ['Electrical Fault Diagnosis', 'home-services', 60, 900, 30, LocationType::ClientLocation, 'A technician traces the fault, explains the cause and quotes the repair before touching anything.'],
                    ['Deep Kitchen Clean', 'home-services', 180, 3200, 30, LocationType::ClientLocation, 'Degreasing of hob, chimney, cabinet fronts and tiling, including appliance exteriors and behind-unit access.'],
                    ['AC Service & Gas Check', 'home-services', 90, 1400, 30, LocationType::ClientLocation, 'Coil clean, filter wash, drainage clear and a refrigerant pressure check with a written report.'],
                ],
            ],
            [
                'name' => 'Sana Sheikh', 'email' => 'sana@yopmail.com',
                'business' => 'Sheikh & Frame',
                'headline' => 'Portrait and event photography with a documentary eye.',
                'bio' => 'Available light, minimal direction, honest frames. Portfolio work spans weddings, family portraits and small-business product shoots.',
                'city' => 4,
                'address' => 'Road No. 12, Banjara Hills',
                'services' => [
                    ['Portrait Session', 'photography', 90, 6500, 30, LocationType::OnSite, 'A ninety-minute studio or on-location session, with twenty retouched frames delivered inside a week.'],
                    ['Product Shoot (Half Day)', 'photography', 240, 15000, 60, LocationType::OnSite, 'Up to fifteen products on white or styled backgrounds, colour-corrected and web-optimised.'],
                    ['Photo Review Call', 'photography', 30, 800, 0, LocationType::Remote, 'A portfolio critique over video — bring twenty images and leave with an edit plan.'],
                ],
            ],
            [
                'name' => 'Vikram Iyer', 'email' => 'vikram@yopmail.com',
                'business' => 'Iyer Advisory',
                'headline' => 'Tax and company-structure advice for freelancers.',
                'bio' => 'Chartered accountant working almost entirely with independent professionals and small studios. Plain-language advice, no jargon.',
                'city' => 5,
                'address' => 'Anna Salai, Teynampet',
                'services' => [
                    ['Tax Planning Consultation', 'consulting', 60, 3500, 15, LocationType::Remote, 'A working session on your income structure, deductions and advance tax schedule for the year ahead.'],
                    ['Company Setup Advisory', 'consulting', 90, 5000, 15, LocationType::Remote, 'Which structure fits your revenue and risk, what it costs to run, and what filing it commits you to.'],
                    ['Quarterly Books Review', 'consulting', 45, 2200, 15, LocationType::Remote, 'A review of your quarter, flagging anything that will cause trouble at filing time.'],
                ],
            ],
        ];

        $providers = [];

        foreach ($definitions as $definition) {
            $location = self::CITIES[$definition['city']];

            $user = User::updateOrCreate(
                ['email' => $definition['email']],
                [
                    'name' => $definition['name'],
                    'password' => 'password',
                    'role' => UserRole::Provider,
                    'phone' => '+91 98'.random_int(10000000, 99999999),
                ]
            );

            ProviderProfile::updateOrCreate(
                ['user_id' => $user->id],
                [
                    'business_name' => $definition['business'],
                    'slug' => Str::slug($definition['business']),
                    'headline' => $definition['headline'],
                    'bio' => $definition['bio'],
                    'address_line' => $definition['address'],
                    'city' => $location['city'],
                    'state' => $location['state'],
                    'country' => 'India',
                    'postal_code' => $location['postal'],
                    // Jitter the pin slightly so demo providers in the same
                    // city do not stack on one marker.
                    'latitude' => $location['lat'] + (random_int(-40, 40) / 1000),
                    'longitude' => $location['lng'] + (random_int(-40, 40) / 1000),
                    'is_published' => true,
                ]
            );

            $this->seedAvailability($user);

            foreach ($definition['services'] as [$title, $categorySlug, $duration, $price, $buffer, $locationType, $description]) {
                Service::updateOrCreate(
                    ['slug' => Str::slug($title).'-'.$user->id],
                    [
                        'provider_id' => $user->id,
                        'category_id' => $categories[$categorySlug],
                        'title' => $title,
                        'description' => $description,
                        'duration_minutes' => $duration,
                        'buffer_minutes' => $buffer,
                        'price' => $price,
                        'currency' => 'INR',
                        'location_type' => $locationType,
                        'is_active' => true,
                    ]
                );
            }

            $providers[] = $user->fresh(['services', 'providerProfile']);
        }

        return $providers;
    }

    /** @return array<int, User> */
    private function createClients(): array
    {
        $definitions = [
            ['Ananya Sharma', 'client@yopmail.com'],
            ['Rohit Menon', 'rohit@yopmail.com'],
            ['Kavya Reddy', 'kavya@yopmail.com'],
            ['Imran Qureshi', 'imran@yopmail.com'],
            ['Neha Bhatt', 'neha@yopmail.com'],
        ];

        return collect($definitions)
            ->map(fn (array $d) => User::updateOrCreate(
                ['email' => $d[1]],
                [
                    'name' => $d[0],
                    'password' => 'password',
                    'role' => UserRole::Client,
                    'phone' => '+91 97'.random_int(10000000, 99999999),
                ]
            ))
            ->all();
    }

    private function seedAvailability(User $provider): void
    {
        if ($provider->availabilityRules()->exists()) {
            return;
        }

        // Weekdays 09:00–13:00 and 14:00–18:00, plus a Saturday morning.
        foreach (range(1, 5) as $day) {
            $provider->availabilityRules()->create(['day_of_week' => $day, 'start_time' => '09:00', 'end_time' => '13:00']);
            $provider->availabilityRules()->create(['day_of_week' => $day, 'start_time' => '14:00', 'end_time' => '18:00']);
        }

        $provider->availabilityRules()->create(['day_of_week' => 6, 'start_time' => '10:00', 'end_time' => '14:00']);
    }

    /**
     * Spreads bookings over the last five months and the next three weeks so
     * revenue charts, history lists and upcoming panels are all populated.
     */
    private function createBookings(array $providers, array $clients): void
    {
        if (Booking::exists()) {
            return;
        }

        $reviewService = app(ReviewService::class);
        $comments = [
            5 => ['Genuinely excellent — turned up on time and knew exactly what they were doing.', 'Best experience I have had booking anything online. Will be back.', 'Really thoughtful and unhurried. Worth every rupee.'],
            4 => ['Very good session, only note is that it started about ten minutes late.', 'Happy with the result. Communication before the appointment could be a little clearer.', 'Solid work and fair pricing.'],
            3 => ['Fine, did the job. Nothing that stood out either way.', 'Decent, though I expected a bit more for the price.'],
        ];

        $sequence = 0;

        foreach ($providers as $provider) {
            $services = $provider->services;

            // --- Completed and paid, spread across the last five months ---
            foreach (range(1, 9) as $i) {
                $service = $services->random();
                $client = $clients[array_rand($clients)];

                $startsAt = CarbonImmutable::now()
                    ->subDays(random_int(4, 150))
                    ->setTime(random_int(9, 16), [0, 15, 30, 45][array_rand([0, 1, 2, 3])]);

                $booking = $this->makeBooking(++$sequence, $client, $provider, $service, $startsAt, [
                    'status' => BookingStatus::Completed,
                    'confirmed_at' => $startsAt->subDays(2),
                    'completed_at' => $startsAt->addMinutes($service->duration_minutes),
                ]);

                $this->makePayment($booking, PaymentStatus::Succeeded, $startsAt->subDays(2));

                // Roughly two in three completed bookings get reviewed.
                if (random_int(1, 3) > 1) {
                    $rating = [5, 5, 5, 4, 4, 3][array_rand([0, 1, 2, 3, 4, 5])];

                    Review::create([
                        'booking_id' => $booking->id,
                        'service_id' => $service->id,
                        'client_id' => $client->id,
                        'provider_id' => $provider->id,
                        'rating' => $rating,
                        'comment' => $comments[$rating][array_rand($comments[$rating])],
                        'created_at' => $startsAt->addDay(),
                    ]);
                }
            }

            // --- Upcoming confirmed bookings ---
            foreach (range(1, 3) as $i) {
                $service = $services->random();
                $client = $clients[array_rand($clients)];

                $startsAt = CarbonImmutable::now()
                    ->addDays(random_int(2, 20))
                    ->setTime(random_int(9, 16), 0);

                if ($startsAt->isSunday()) {
                    $startsAt = $startsAt->addDay();
                }

                $booking = $this->makeBooking(++$sequence, $client, $provider, $service, $startsAt, [
                    'status' => BookingStatus::Confirmed,
                    'confirmed_at' => now()->subDay(),
                ]);

                $this->makePayment($booking, PaymentStatus::Succeeded, now()->subDay());
            }

            // --- One pending, awaiting payment ---
            $service = $services->random();
            $client = $clients[array_rand($clients)];
            $startsAt = CarbonImmutable::now()->addDays(random_int(3, 12))->setTime(11, 0);

            if ($startsAt->isSunday()) {
                $startsAt = $startsAt->addDay();
            }

            $booking = $this->makeBooking(++$sequence, $client, $provider, $service, $startsAt, [
                'status' => BookingStatus::Pending,
            ]);

            $this->makePayment($booking, PaymentStatus::Pending, null);

            // --- One cancelled, for the history view ---
            $service = $services->random();
            $client = $clients[array_rand($clients)];
            $startsAt = CarbonImmutable::now()->subDays(random_int(10, 60))->setTime(15, 0);

            $this->makeBooking(++$sequence, $client, $provider, $service, $startsAt, [
                'status' => BookingStatus::Cancelled,
                'cancelled_at' => $startsAt->subDays(3),
                'cancelled_by' => $client->id,
                'cancellation_reason' => 'Schedule clash — rebooking for another week.',
            ]);
        }

        // Recompute the denormalised rating aggregates now the reviews exist.
        foreach ($providers as $provider) {
            foreach ($provider->services as $service) {
                $reviewService->recalculateAggregates($service, $provider);
            }
        }

        // And the bookings_count column on each service.
        foreach (Service::all() as $service) {
            $service->update(['bookings_count' => $service->bookings()->count()]);
        }
    }

    private function makeBooking(int $sequence, User $client, User $provider, Service $service, CarbonImmutable $startsAt, array $attributes): Booking
    {
        return Booking::create(array_merge([
            'code' => 'BKG-'.str_pad((string) $sequence, 6, '0', STR_PAD_LEFT),
            'client_id' => $client->id,
            'provider_id' => $provider->id,
            'service_id' => $service->id,
            'starts_at' => $startsAt,
            'ends_at' => $startsAt->addMinutes($service->duration_minutes),
            'duration_minutes' => $service->duration_minutes,
            'price_amount' => $service->price,
            'currency' => $service->currency,
            'created_at' => $startsAt->subDays(3),
        ], $attributes));
    }

    private function makePayment(Booking $booking, PaymentStatus $status, ?\DateTimeInterface $paidAt): Payment
    {
        return Payment::create([
            'booking_id' => $booking->id,
            'client_id' => $booking->client_id,
            'provider_id' => $booking->provider_id,
            'amount' => $booking->price_amount,
            'currency' => $booking->currency,
            'status' => $status,
            'gateway' => 'simulated',
            'reference' => 'sim_'.Str::random(24),
            'paid_at' => $paidAt,
            'created_at' => $paidAt ?? $booking->created_at,
        ]);
    }
}
