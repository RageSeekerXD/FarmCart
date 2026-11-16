import { useTranslation } from 'react-i18next';
import type { AddressDetails } from '../api/types';

/** «під'їзд 2, поверх 3, домофон 5К» - лише ті частини, що є (фермер, кур'єр, накладна). */
export function useAddressDetailsText() {
  const { t } = useTranslation();
  return (details: AddressDetails | null) =>
    details
      ? [
          details.entrance && t('address.entrance', { value: details.entrance }),
          details.floor && t('address.floor', { value: details.floor }),
          details.intercom && t('address.intercom', { value: details.intercom }),
        ]
          .filter(Boolean)
          .join(', ')
      : '';
}
