'use client';

// oxlint-disable react-doctor/no-giant-component react-doctor/prefer-useReducer react-doctor/rendering-usetransition-loading
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Mail, Loader2, ArrowLeft } from 'lucide-react';

type Step = 'email' | 'code';
const CODE_INPUT_IDS = ['code-0', 'code-1', 'code-2', 'code-3', 'code-4', 'code-5'];

export function LoginForm() {
  const { push } = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const focusFirstCodeInput = () => {
    queueMicrotask(() => inputRefs.current[0]?.focus());
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (data.success) {
        if (data.waitingApproval) {
          setMessage({
            type: 'success',
            text:
              data.message ??
              'Czekasz na zatwierdzenie przez administratora. Otrzymasz maila z kodem po zatwierdzeniu.',
          });
          // Zostajemy na kroku email – bez kodu
        } else {
          setStep('code');
          setMessage({
            type: 'success',
            text: 'Kod został wysłany na podany adres email',
          });
          focusFirstCodeInput();
        }
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch {
      setMessage({ type: 'error', text: 'Wystąpił błąd. Spróbuj ponownie.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits entered
    if (value && index === 5 && newCode.every((d) => d !== '')) {
      handleCodeSubmit(newCode.join(''));
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, 6);
    if (pasted.length === 6) {
      const newCode = pasted.split('');
      setCode(newCode);
      inputRefs.current[5]?.focus();
      handleCodeSubmit(pasted);
    }
  };

  const handleCodeSubmit = async (codeValue?: string) => {
    const submitCode = codeValue || code.join('');
    if (submitCode.length !== 6) return;

    setIsLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: submitCode }),
      });

      const data = await res.json();

      if (data.success) {
        push(data.redirectUrl);
      } else {
        setMessage({ type: 'error', text: data.message });
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch {
      setMessage({ type: 'error', text: 'Wystąpił błąd. Spróbuj ponownie.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setStep('email');
    setCode(['', '', '', '', '', '']);
    setMessage(null);
  };

  const handleResendCode = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Nowy kod został wysłany' });
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch {
      setMessage({ type: 'error', text: 'Wystąpił błąd. Spróbuj ponownie.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-semibold whitespace-nowrap">
          <span className="text-[0.7em]">CONCEPTFAB</span>{' '}
          <span className="text-[0.91em] font-normal text-muted-foreground">
            Pano{' '}
            <span className="text-[10px]">
              v: {process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0'}
            </span>
          </span>
        </CardTitle>
        <CardDescription>
          {step === 'email'
            ? 'Zaloguj się używając adresu email'
            : `Wpisz 6-cyfrowy kod wysłany na ${email}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === 'email' ? (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Adres email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="twoj@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {message && (
              <div
                className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                  message.type === 'success'
                    ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
                    : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                }`}
              >
                {message.text}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Wysyłanie…
                </>
              ) : (
                'Wyślij kod'
              )}
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              disabled={isLoading}
            >
              <ArrowLeft className="size-4" />
              Zmień email
            </button>

            <div className="flex justify-center gap-2" onPaste={handlePaste}>
              {CODE_INPUT_IDS.map((inputId, index) => (
                <Input
                  key={inputId}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  aria-label={`Cyfra ${index + 1} kodu weryfikacyjnego`}
                  maxLength={1}
                  value={code[index]}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-12 h-14 text-center text-2xl font-mono"
                  disabled={isLoading}
                />
              ))}
            </div>

            {message && (
              <div
                className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                  message.type === 'success'
                    ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
                    : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                }`}
              >
                {message.text}
              </div>
            )}

            <Button
              type="button"
              onClick={() => handleCodeSubmit()}
              className="w-full"
              disabled={isLoading || code.some((d) => d === '')}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Weryfikacja…
                </>
              ) : (
                'Zaloguj się'
              )}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={handleResendCode}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                disabled={isLoading}
              >
                Nie dostałeś kodu? Wyślij ponownie
              </button>
            </div>
          </div>
        )}

        <p className="mt-4 text-xs text-center text-muted-foreground">
          {step === 'email'
            ? 'Na podany adres zostanie wysłany 6-cyfrowy kod weryfikacyjny.'
            : 'Kod jest ważny przez 10 minut.'}
        </p>
      </CardContent>
    </Card>
  );
}
