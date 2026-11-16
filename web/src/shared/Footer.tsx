import AgricultureOutlinedIcon from '@mui/icons-material/AgricultureOutlined';
import AssignmentReturnOutlinedIcon from '@mui/icons-material/AssignmentReturnOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import SupportAgentOutlinedIcon from '@mui/icons-material/SupportAgentOutlined';
import { Box, Container, Link, Stack, Typography, useTheme } from '@mui/material';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';

/** Контакти підтримки: адреса й телефон-заглушки (домен example зарезервовано для прикладів) - замініть справжніми. */
export const SUPPORT = { phone: '+380 32 000 00 00', phoneHref: 'tel:+380320000000', email: 'support@farmcart.example' } as const;

function Column({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Box component="section" aria-label={title}>
      <Typography component="h2" variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, color: 'text.primary', '& svg': { color: 'primary.main' } }}>
        {icon}
        {title}
      </Typography>
      <Stack spacing={0.75} sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
        {children}
      </Stack>
    </Box>
  );
}

const linkSx = { color: 'text.secondary', fontWeight: 500, '&:hover': { color: 'primary.main' } } as const;

/**
 * Підвал сайту: умови доставки й зберігання, повернення, контакти підтримки й реєстрація для фермерів -
 * те, що покупець шукає, перш ніж довірити свіжі продукти новому сервісу. Детально - на сторінці /info.
 */
export function Footer() {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Box component="footer" sx={{ mt: 4, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Container maxWidth="lg" sx={{ py: { xs: 3, sm: 4 }, px: { xs: 1.5, sm: 3 } }}>
        <Box sx={{ display: 'grid', gap: { xs: 3, md: 4 }, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' } }}>
          <Column icon={<LocalShippingOutlinedIcon fontSize="small" />} title={t('footer.delivery')}>
            <Typography variant="body2" color="inherit">
              {t('footer.deliveryText')}
            </Typography>
            <Link component={RouterLink} to="/info#delivery" variant="body2" underline="hover" sx={linkSx}>
              {t('footer.deliveryLink')}
            </Link>
          </Column>
          <Column icon={<AssignmentReturnOutlinedIcon fontSize="small" />} title={t('footer.returns')}>
            <Typography variant="body2" color="inherit">
              {t('footer.returnsText')}
            </Typography>
            <Link component={RouterLink} to="/info#returns" variant="body2" underline="hover" sx={linkSx}>
              {t('footer.returnsLink')}
            </Link>
          </Column>
          <Column icon={<SupportAgentOutlinedIcon fontSize="small" />} title={t('footer.support')}>
            <Link href={SUPPORT.phoneHref} variant="body2" underline="hover" sx={{ ...linkSx, color: 'text.primary', fontWeight: 700 }}>
              {SUPPORT.phone}
            </Link>
            <Link href={`mailto:${SUPPORT.email}`} variant="body2" underline="hover" sx={linkSx}>
              {SUPPORT.email}
            </Link>
            <Typography variant="body2" color="inherit">
              {t('footer.supportHours')}
            </Typography>
          </Column>
          <Column icon={<AgricultureOutlinedIcon fontSize="small" />} title={t('footer.farmers')}>
            <Typography variant="body2" color="inherit">
              {t('footer.farmersText')}
            </Typography>
            <Link component={RouterLink} to="/farmer/register" variant="body2" underline="hover" sx={{ ...linkSx, color: 'primary.main', fontWeight: 700 }}>
              {t('footer.farmersLink')}
            </Link>
          </Column>
        </Box>
        <Typography variant="body2" sx={{ mt: { xs: 3, sm: 4 }, pt: 2, borderTop: 1, borderColor: 'divider', color: 'text.secondary', textAlign: 'center' }}>
          {theme.brand.emoji} <strong>{t('app.name')}</strong> · {t('app.tagline')} · © {new Date().getFullYear()}
        </Typography>
      </Container>
    </Box>
  );
}
