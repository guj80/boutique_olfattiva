import { Transition } from 'framer-motion';

export const springSoft: Transition = {
  type: 'spring',
  stiffness: 260,
  damping: 30,
};

export const springSnappy: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 32,
};

export const darkTransition: Transition = {
  duration: 0.8,
  ease: [0.22, 1, 0.36, 1],
};
