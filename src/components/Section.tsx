import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { reveal, stagger } from '../lib/motion'

export function Section({
  id,
  eyebrow,
  title,
  aside,
  children,
}: {
  id?: string
  eyebrow?: string
  title: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <motion.section
      id={id}
      className="section"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      variants={stagger}
    >
      <motion.header className="section-head" variants={reveal}>
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2>{title}</h2>
        </div>
        {aside}
      </motion.header>
      {children}
    </motion.section>
  )
}
