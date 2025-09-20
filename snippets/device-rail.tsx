import { motion } from 'framer-motion';

interface DeviceRailProps {
  heading: string;
  description: string;
  screenshots: Array<{ src: string; alt: string; label: string }>;
}

/**
 * Animated device rail with subtle 3D tilt and autoplay reveal.
 * Pair with gradients behind the section for extra depth.
 */
export function DeviceRail({ heading, description, screenshots }: DeviceRailProps) {
  return (
    <section className="relative overflow-hidden bg-slate-950 py-20 text-white">
      <div className="absolute inset-0 opacity-40">
        <div className="absolute inset-x-0 top-1/3 h-64 bg-gradient-to-r from-purple-500/40 via-sky-500/20 to-teal-400/30 blur-[140px]" />
      </div>
      <div className="relative mx-auto flex max-w-6xl flex-col gap-12 px-6">
        <div className="max-w-3xl space-y-4 text-center md:text-left">
          <h2 className="text-4xl font-semibold leading-tight text-balance">{heading}</h2>
          <p className="text-lg text-white/70">{description}</p>
        </div>

        <div className="relative flex flex-col gap-16">
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="grid gap-8 md:grid-cols-3">
            {screenshots.map((shot, index) => (
              <motion.article
                key={shot.src}
                className="group relative rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur"
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ rotateX: -4, rotateY: 6, scale: 1.02 }}
              >
                <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl shadow-slate-950/60">
                  <motion.img
                    src={shot.src}
                    alt={shot.alt}
                    className="h-full w-full object-cover"
                    initial={{ scale: 1.05 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.4 + index * 0.12, duration: 0.8, ease: [0.33, 1, 0.68, 1] }}
                  />
                </div>
                <div className="mt-5 flex items-center justify-between text-sm text-white/70">
                  <span className="font-medium text-white/90">{shot.label}</span>
                  <motion.span
                    className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.28em]"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + index * 0.12, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <span className="i-ph:waveform-duotone text-sm" />
                    Live demo
                  </motion.span>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
