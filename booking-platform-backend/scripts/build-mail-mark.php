<?php

/*
 * Rasterises the Slotwise mark for email.
 *
 * Gmail and Outlook do not render inline SVG, and Outlook will not render a
 * CSS-drawn shape either, so the mark has to ship as a PNG. Drawn here rather
 * than committed as a binary blob so it stays in step with public/mark.svg —
 * rerun this if the mark changes.
 *
 *   php scripts/build-mail-mark.php
 */

$scale = 16;              // supersampled, then downsampled for smooth edges
$box = 32 * $scale;       // the SVG viewBox is 32x32

$img = imagecreatetruecolor($box, $box);
imagealphablending($img, false);
imagesavealpha($img, true);
imagefill($img, 0, 0, imagecolorallocatealpha($img, 0, 0, 0, 127));
imagealphablending($img, true);

// The site accent, not the older #C2410C still sitting in public/mark.svg.
$accent = imagecolorallocate($img, 0xA6, 0x3D, 0x2A);
$white = imagecolorallocate($img, 255, 255, 255);

// Rounded square, rx 7.
$r = 7 * $scale;
imagefilledrectangle($img, $r, 0, $box - $r, $box, $accent);
imagefilledrectangle($img, 0, $r, $box, $box - $r, $accent);

foreach ([[$r, $r], [$box - $r, $r], [$r, $box - $r], [$box - $r, $box - $r]] as [$cx, $cy]) {
    imagefilledellipse($img, $cx, $cy, $r * 2, $r * 2, $accent);
}

// Clock face: a white ring of stroke width 2.2 centred on radius 9. Drawn as
// a filled disc with a smaller accent disc punched out of it, because GD's
// arc stroking is not antialiased.
$c = 16 * $scale;
$ring = fn (float $radius, int $colour) => imagefilledellipse(
    $img, $c, $c, (int) round($radius * 2 * $scale), (int) round($radius * 2 * $scale), $colour
);

$ring(9 + 1.1, $white);
$ring(9 - 1.1, $accent);

// The booked slot: a filled quadrant from 12 to 3 o'clock.
imagefilledarc($img, $c, $c, 7 * 2 * $scale, 7 * 2 * $scale, 270, 360, $white, IMG_ARC_PIE);

// Down to 128px — displayed at 26px, so it stays sharp on a retina screen.
$out = imagecreatetruecolor(128, 128);
imagealphablending($out, false);
imagesavealpha($out, true);
imagefill($out, 0, 0, imagecolorallocatealpha($out, 0, 0, 0, 127));
imagecopyresampled($out, $img, 0, 0, 0, 0, 128, 128, $box, $box);

$target = __DIR__.'/../public/mail/mark.png';

if (! is_dir(dirname($target))) {
    mkdir(dirname($target), 0755, true);
}

imagepng($out, $target);

echo 'Wrote '.realpath($target).' ('.filesize($target)." bytes)\n";
