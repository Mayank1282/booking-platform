# Render has no native PHP runtime — Docker is the only way to run Laravel there.
#
# PHP 8.4 satisfies composer.json's ^8.3. The CLI image plus `artisan serve` is
# deliberate rather than nginx + php-fpm: this is a demo on a single free
# instance, and two processes under a supervisor would be more moving parts to
# go wrong than the traffic justifies.
FROM php:8.4-cli

# git and unzip are for Composer; the -dev packages are headers the PHP
# extensions below need to compile against.
RUN apt-get update && apt-get install -y --no-install-recommends \
        git unzip libzip-dev libpng-dev libjpeg-dev libfreetype6-dev libonig-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" pdo_mysql mbstring bcmath zip gd exif opcache \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# pdo_mysql — Aiven.  bcmath — money arithmetic must not go through floats.
# gd — generates the mail logo and service artwork.  zip/mbstring — Composer
# and string handling.

# OPcache is not on in the CLI image, so Laravel recompiles every file it
# touches on every request. On Render's 0.1 CPU that dominates the response
# time. validate_timestamps=0 skips the stat() on each file — safe because the
# code cannot change without rebuilding the image.
RUN {       echo 'opcache.enable=1';       echo 'opcache.enable_cli=0';       echo 'opcache.memory_consumption=128';       echo 'opcache.interned_strings_buffer=16';       echo 'opcache.max_accelerated_files=20000';       echo 'opcache.validate_timestamps=0';       echo 'realpath_cache_size=4096K';       echo 'realpath_cache_ttl=600';     } > /usr/local/etc/php/conf.d/opcache.ini

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

# Copy the manifests first so this layer is cached: application code changes
# then do not force a full dependency reinstall on every deploy.
COPY composer.json composer.lock ./

# Scripts are skipped here because artisan needs the full source, which has not
# been copied yet.
RUN composer install --no-dev --optimize-autoloader --no-interaction --no-scripts --prefer-dist

COPY . .

RUN composer dump-autoload --optimize --no-dev --no-interaction \
    && mkdir -p storage/framework/{cache,sessions,views} storage/logs bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

# Config is NOT cached at build time. Render injects environment variables at
# runtime, so a config cache baked into the image would freeze whatever was
# present during the build — usually nothing — and the app would boot with no
# database credentials and no keys. It is cached on startup instead, once the
# real environment exists.

EXPOSE 10000

# `sh -c` so $PORT expands. Render assigns it and it is not known until runtime.
# `migrate --force` runs on boot because the free tier has no shell to run it
# by hand. It is idempotent — a deploy with nothing new to apply exits cleanly.
CMD sh -c "php artisan migrate --force && php artisan config:cache && php artisan route:cache && php artisan view:cache && php artisan serve --host 0.0.0.0 --port ${PORT:-10000}"
