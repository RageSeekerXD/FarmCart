import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import { Autocomplete, Box, TextField, Typography, type TextFieldProps } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useLang } from '../i18n';
import { useAddressSuggestions, type AddressSuggestion } from './geocode';

interface Props {
  value: string;
  onChange: (text: string) => void;
  /** Обрано підказку: адреса з точкою на мапі. */
  onPick: (suggestion: AddressSuggestion) => void;
  label: string;
  helperText?: TextFieldProps['helperText'];
  error?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  size?: 'small' | 'medium';
}

/**
 * Поле адреси з підказками вулиць і будинків (OpenStreetMap): набирати можна вільно, підказка лише допомагає
 * й додає точку на мапі. Без мережі чи геокодера поле працює як звичайне.
 */
export function AddressAutocomplete({ value, onChange, onPick, label, helperText, error, required, autoFocus, size }: Props) {
  const { t } = useTranslation();
  const { lang } = useLang();
  const suggestions = useAddressSuggestions(value, lang);

  return (
    <Autocomplete<AddressSuggestion, false, false, true>
      freeSolo
      options={suggestions.data ?? []}
      filterOptions={(options) => options}
      getOptionLabel={(option) => (typeof option === 'string' ? option : option.label)}
      inputValue={value}
      onInputChange={(_, text, reason) => {
        if (reason !== 'reset') {
          onChange(text);
        }
      }}
      onChange={(_, picked) => {
        if (picked && typeof picked !== 'string') {
          onChange(picked.label);
          onPick(picked);
        }
      }}
      loading={suggestions.isFetching}
      loadingText={t('common.loading')}
      noOptionsText={t('address.noSuggestions')}
      renderOption={(props, option) => {
        const { key, ...rest } = props as typeof props & { key: string };
        return (
          <Box component="li" key={key} {...rest} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <PlaceOutlinedIcon fontSize="small" sx={{ color: 'text.secondary', mt: '2px' }} />
            <Typography variant="body2">{option.label}</Typography>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required={required}
          error={error}
          autoFocus={autoFocus}
          size={size}
          helperText={helperText}
          slotProps={{ ...params.slotProps, htmlInput: { ...params.slotProps.htmlInput, autoComplete: 'street-address' } }}
        />
      )}
    />
  );
}
