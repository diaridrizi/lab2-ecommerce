import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { ArrowLeft, ArrowRight } from './Icons.jsx';

const DURATION = 6000; // ms per slide

// Slides come from MongoDB (Admin → Banners)
export default function HeroSlider() {
  const [slides, setSlides] = useState(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    api.get('/banners').then(setSlides).catch(() => setSlides([]));
  }, []);

  const count = slides?.length ?? 0;

  useEffect(() => {
    if (paused || count < 2) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % count), DURATION);
    return () => clearTimeout(t);
  }, [index, paused, count]);

  const go = (dir) => setIndex((i) => (i + dir + count) % count);

  if (slides === null) return <section className="hero-slider skeleton" />;
  if (count === 0) return null; // no active banners: just skip the slideshow

  const SLIDES = slides.map((s) => ({
    image: s.image, eyebrow: s.eyebrow, title: s.title, text: s.text, cta: s.ctaLabel || 'Shop now', to: s.ctaLink || '/shop', id: s._id,
  }));

  return (
    <section
      className={`hero-slider ${paused ? 'paused' : ''}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
    >
      {SLIDES.map((s, i) => {
        const external = /^https?:\/\//.test(s.to);
        const tab = i === index ? 0 : -1;
        return (
          <div key={s.id} className={`slide ${i === index ? 'active' : ''}`} aria-hidden={i !== index}>
            <img src={s.image} alt="" className="slide-img" />
            <div className="slide-shade" />
            <div className="container slide-content">
              {s.eyebrow && <span className="slide-eyebrow">{s.eyebrow}</span>}
              <h1 className="slide-title">{s.title}</h1>
              {s.text && <p className="slide-text">{s.text}</p>}
              {external
                ? <a href={s.to} className="btn btn-light btn-lg" tabIndex={tab}>{s.cta}</a>
                : <Link to={s.to} className="btn btn-light btn-lg" tabIndex={tab}>{s.cta}</Link>}
            </div>
          </div>
        );
      })}

      {count > 1 && (
        <>
          <button className="slider-arrow prev" onClick={() => go(-1)} aria-label="Previous slide"><ArrowLeft /></button>
          <button className="slider-arrow next" onClick={() => go(1)} aria-label="Next slide"><ArrowRight /></button>
          <div className="slider-dots">
            {SLIDES.map((s, i) => (
              <button key={s.id} className={`slider-dot ${i === index ? 'active' : ''}`} onClick={() => setIndex(i)} aria-label={`Slide ${i + 1}`}>
                {/* key forces the progress bar to restart on every slide */}
                <span key={i === index ? index : 'idle'} style={{ animationDuration: `${DURATION}ms` }} />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
