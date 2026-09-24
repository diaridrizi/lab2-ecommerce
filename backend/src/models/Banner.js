// MongoDB model: homepage slideshow banners, managed in Admin → Banners.
// Content-like documents that change often and have no relations — a good fit for MongoDB.
import mongoose from 'mongoose';

const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    eyebrow: { type: String, trim: true, maxlength: 40, default: '' }, // small label above the title
    text: { type: String, trim: true, maxlength: 200, default: '' },
    image: { type: String, required: true, trim: true },                // URL or /images/... path
    ctaLabel: { type: String, trim: true, maxlength: 40, default: 'Shop now' },
    ctaLink: { type: String, trim: true, default: '/shop' },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Banner = mongoose.model('Banner', bannerSchema);
