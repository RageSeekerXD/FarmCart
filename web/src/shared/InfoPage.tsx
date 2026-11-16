import AgricultureOutlinedIcon from '@mui/icons-material/AgricultureOutlined';
import AssignmentReturnOutlinedIcon from '@mui/icons-material/AssignmentReturnOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import SupportAgentOutlinedIcon from '@mui/icons-material/SupportAgentOutlined';
import { Box, Button, Link, Paper, Typography } from '@mui/material';
import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { SUPPORT } from './Footer';

function Section({ id, icon, title, items, children }: { id: string; icon: ReactNode; title: string; items: string[]; children?: ReactNode }) {
  return (
    <Paper component="section" id={id} aria-labelledby={`${id}-title`} elevation={1} sx={{ p: { xs: 2, sm: 3 }, scrollMarginTop: 120 }}>
      <Typography id={`${id}-title`} component="h2" variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, '& svg': { color: 'primary.main' } }}>
        {icon}
        {title}
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5, '& li + li': { mt: 1 }, maxWidth: '75ch' }}>
        {items.map((item) => (
          <Typography component="li" key={item}>
            {item}
          </Typography>
        ))}
      </Box>
      {children}
    </Paper>
  );
}

/** Умови сервісу для покупців і фермерів: доставка й зберігання, повернення, підтримка, як стати продавцем. */
export function InfoPage() {
  const { t } = useTranslation();
  const { hash } = useLocation();
  // Перехід з підвалу на розділ: прокрутити до нього, коли сторінка вже намальована.
  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView?.({ block: 'start' });
    }
  }, [hash]);

  const list = (key: string) => t(key, { returnObjects: true }) as string[];
  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Typography component="h1" variant="h4" sx={{ mb: 1, fontSize: { xs: '1.6rem', sm: '2.1rem' } }}>
        {t('info.title')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {t('info.intro')}
      </Typography>
      <Box sx={{ display: 'grid', gap: 2 }}>
        <Section id="delivery" icon={<LocalShippingOutlinedIcon />} title={t('footer.delivery')} items={list('info.delivery')} />
        <Section id="returns" icon={<AssignmentReturnOutlinedIcon />} title={t('footer.returns')} items={list('info.returns')} />
        <Section id="support" icon={<SupportAgentOutlinedIcon />} title={t('footer.support')} items={[t('footer.supportHours'), t('info.supportChannels')]}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 2 }}>
            <Button variant="contained" href={SUPPORT.phoneHref}>
              {SUPPORT.phone}
            </Button>
            <Button variant="outlined" href={`mailto:${SUPPORT.email}`}>
              {SUPPORT.email}
            </Button>
          </Box>
        </Section>
        <Section id="farmers" icon={<AgricultureOutlinedIcon />} title={t('footer.farmers')} items={list('info.farmers')}>
          <Button component={RouterLink} to="/farmer/register" variant="contained" sx={{ mt: 2 }}>
            {t('footer.farmersLink')}
          </Button>
        </Section>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        {t('info.questions')}{' '}
        <Link href={`mailto:${SUPPORT.email}`} underline="hover">
          {SUPPORT.email}
        </Link>
      </Typography>
    </Box>
  );
}
