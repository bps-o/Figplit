import { motion } from 'framer-motion';

type GlassHeroProps = {
  eyebrow?: string;
  heading: string;
  copy: string;
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
};

/**
 * Frosted-glass hero with orbital gradient accents and staggered content entrance.
 * Works great for AI, analytics, or productivity tools that want a cinematic opening.
 */
export function GlassHeroOrbits({
  eyebrow = 'Featured launch',
  heading,
  copy,
  primaryCta,
  secondaryCta,
}: GlassHeroProps) {
  return (
    <section className="relative overflow-hidden bg-slate-950 py-24 text-white">
      <div className="absolute inset-0">
        <div className="absolute -top-40 right-10 h-72 w-72 rounded-full bg-gradient-to-br from-fuchsia-500/40 via-purple-400/20 to-sky-400/30 blur-3xl" />
        <div className="absolute bottom-[-200px] left-1/4 h-[420px] w-[420px] rounded-full bg-gradient-to-tl from-emerald-500/40 via-cyan-400/20 to-transparent blur-[120px]" />
        <motion.div
          aria-hidden
          className="absolute inset-0"
          initial={{ rotate: 0 }}
          animate={{ rotate: 360 }}
          transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
        >
          <div className="absolute left-[45%] top-16 h-12 w-12 rounded-full border border-white/30 bg-white/10 blur-[1px]" />
          <div className="absolute bottom-28 right-[20%] h-16 w-16 rounded-full border border-white/40 bg-white/5" />
        </motion.div>
      </div>

      <div className="relative mx-auto flex max-w-5xl flex-col items-center gap-8 px-6 text-center">
        <motion.span
          className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em]"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="i-ph:sparkle-duotone text-sm" />
          {eyebrow}
        </motion.span>
        <motion.h1
          className="text-balance text-5xl font-bold sm:text-6xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          {heading}
        </motion.h1>
        <motion.p
          className="max-w-2xl text-lg text-white/70"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          {copy}
        </motion.p>
        <motion.div
          className="flex flex-wrap items-center justify-center gap-4"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.08, delayChildren: 0.45 } },
          }}
        >
          <motion.a
            variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.98 }}
            href={primaryCta.href}
            className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-fuchsia-500/25"
          >
            {primaryCta.label}
          </motion.a>
          {secondaryCta ? (
            <motion.a
              variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              href={secondaryCta.href}
              className="rounded-full border border-white/30 bg-white/5 px-6 py-3 text-sm font-semibold text-white/90 backdrop-blur"
            >
              {secondaryCta.label}
            </motion.a>
          ) : null}
        </motion.div>
      </div>
    </section>
  );
}
