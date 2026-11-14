import { alpha, Box, Paper, Typography } from '@mui/material';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { confettiFall, drawStroke, EASE_SPRING, popIn } from '../../shared/motion';

const COLORS = ['#ffb300', '#43a047', '#e53935', '#1e88e5', '#8e24aa', '#fb8c00'];

/** Конфеті з передбачуваними (а не випадковими) параметрами: рендер чистий, а картинка однакова щоразу. */
const PIECES = Array.from({ length: 22 }, (_, index) => ({
  left: (index * 37) % 100,
  delay: (index % 7) * 70,
  duration: 1300 + ((index * 53) % 700),
  drift: ((index * 29) % 80) - 40,
  spin: 240 + ((index * 61) % 360),
  color: COLORS[index % COLORS.length],
  size: 6 + (index % 3) * 2,
  round: index % 4 === 0,
}));

/** Святкове підтвердження одразу після оформлення: галочка «малюється», зверху сиплеться конфеті. */
export function PlacedBanner() {
  const { t } = useTranslation();

  return (
    <Paper
      elevation={1}
      sx={(theme) => ({
        position: 'relative',
        overflow: 'hidden',
        p: { xs: 2.5, sm: 3 },
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.12)} 0%, ${theme.palette.background.paper} 70%)`,
        animation: `${popIn} 480ms ${EASE_SPRING} backwards`,
      })}
    >
      <Box aria-hidden sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {PIECES.map((piece, index) => (
          <Box
            key={index}
            component="span"
            style={{ '--drift': `${piece.drift}px`, '--spin': `${piece.spin}deg` } as CSSProperties}
            sx={{
              position: 'absolute',
              top: 0,
              left: `${piece.left}%`,
              width: piece.size,
              height: piece.round ? piece.size : piece.size * 1.6,
              borderRadius: piece.round ? '50%' : '2px',
              bgcolor: piece.color,
              opacity: 0,
              animation: `${confettiFall} ${piece.duration}ms ease-out ${piece.delay}ms forwards`,
            }}
          />
        ))}
      </Box>
      <Box
        component="svg"
        viewBox="0 0 52 52"
        aria-hidden
        sx={{ width: 56, height: 56, flexShrink: 0, color: 'success.main', position: 'relative' }}
      >
        <circle cx="26" cy="26" r="24" fill="currentColor" opacity="0.14" />
        <Box
          component="circle"
          cx="26"
          cy="26"
          r="24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          sx={{ strokeDasharray: 151, strokeDashoffset: 151, animation: `${drawStroke} 600ms ease-out forwards` }}
        />
        <Box
          component="path"
          d="M15 27 l7 7 l15 -16"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          sx={{ strokeDasharray: 40, strokeDashoffset: 40, animation: `${drawStroke} 420ms ease-out 480ms forwards` }}
        />
      </Box>
      <Box sx={{ position: 'relative' }}>
        <Typography component="p" variant="h6">
          {t('orders.placedTitle')}
        </Typography>
        <Typography color="text.secondary">{t('orders.placedHint')}</Typography>
      </Box>
    </Paper>
  );
}
