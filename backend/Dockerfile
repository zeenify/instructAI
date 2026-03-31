FROM php:8.3-fpm

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git curl libpng-dev libonig-dev libxml2-dev zip unzip libpq-dev

# Install PHP extensions
RUN docker-php-ext-install pdo pdo_pgsql mbstring

# Get latest Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Set working directory
WORKDIR /var/www

# Copy existing application directory contents
COPY . /var/www

# Install dependencies
RUN composer install --no-dev --optimize-autoloader

# Expose port 10000 and start php-fpm server
EXPOSE 10000
CMD php artisan serve --host=0.0.0.0 --port=10000