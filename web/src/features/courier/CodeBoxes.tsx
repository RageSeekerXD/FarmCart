import { Box } from '@mui/material';
import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  value: string;
  onChange: (code: string) => void;
  /** Підпис першого поля (і всього коду для читачів екрана): «Код вручення: Доставка №1004». */
  label: string;
  length?: number;
  error?: boolean;
}

/**
 * Код вручення чотирма великими клітинками для набору однією рукою: цифрова клавіатура (inputmode=numeric),
 * перехід до наступної клітинки після цифри, Backspace повертає назад, вставлений чи автозаповнений код
 * розкладається по клітинках.
 */
export function CodeBoxes({ value, onChange, label, length = 4, error = false }: Props) {
  const { t } = useTranslation();
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, index) => value[index] ?? '');

  const focus = (index: number) => inputs.current[Math.max(0, Math.min(length - 1, index))]?.focus();

  /** Нові цифри з позиції index: одна - звичайний набір, кілька - вставка чи автозаповнення. */
  const put = (index: number, text: string) => {
    const typed = text.replace(/\D/g, '');
    if (typed === '') {
      return;
    }

    const next = [...digits];
    typed
      .slice(0, length - index)
      .split('')
      .forEach((digit, offset) => {
        next[index + offset] = digit;
      });
    onChange(next.join('').slice(0, length));
    focus(index + typed.length);
  };

  const keyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      const next = [...digits];
      if (next[index]) {
        next[index] = '';
      } else if (index > 0) {
        next[index - 1] = '';
        focus(index - 1);
      }

      onChange(next.join(''));
    } else if (event.key === 'ArrowLeft') {
      focus(index - 1);
    } else if (event.key === 'ArrowRight') {
      focus(index + 1);
    }
  };

  const paste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    put(index, event.clipboardData.getData('text'));
  };

  return (
    <Box role="group" aria-label={t('courier.codeBoxes')} sx={{ display: 'grid', gridTemplateColumns: `repeat(${length}, 1fr)`, gap: 1.25, maxWidth: 320 }}>
      {digits.map((digit, index) => (
        <Box
          key={index}
          component="input"
          ref={(element: HTMLInputElement | null) => {
            inputs.current[index] = element;
          }}
          value={digit}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          aria-label={index === 0 ? label : t('courier.codeDigit', { n: index + 1, of: length })}
          onChange={(event) => {
            const text = event.target.value;
            if (text === '') {
              const next = [...digits];
              next[index] = '';
              onChange(next.join(''));
              return;
            }

            // Клітинка вже мала цифру й отримала ще одну (курсор не виділяв стару) - лишається нова.
            const fresh = digit !== '' && text.length === 2 && text.includes(digit) ? text.replace(digit, '') : text;
            put(index, fresh);
          }}
          onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => keyDown(index, event)}
          onPaste={(event: ClipboardEvent<HTMLInputElement>) => paste(index, event)}
          onFocus={(event) => event.currentTarget.select()}
          sx={{
            width: '100%',
            height: 64,
            textAlign: 'center',
            fontSize: '2rem',
            fontWeight: 700,
            fontFamily: 'inherit',
            color: 'text.primary',
            bgcolor: 'background.paper',
            border: 2,
            borderColor: error ? 'error.main' : digit ? 'primary.main' : 'divider',
            borderRadius: 2,
            outline: 'none',
            transition: 'border-color 150ms ease, box-shadow 150ms ease',
            '&:focus': { borderColor: 'primary.main', boxShadow: (theme) => `0 0 0 4px ${theme.palette.primary.main}33` },
          }}
        />
      ))}
    </Box>
  );
}
