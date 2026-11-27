jest.mock('react-native', () => ({
  Linking: {
    openURL: jest.fn(),
    canOpenURL: jest.fn(),
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    getInitialURL: jest.fn(async () => null),
  },
  Platform: {
    OS: 'ios',
  },
  Alert: {
    alert: jest.fn(),
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock('../src/services/api', () => ({
  getBaseURL: jest.fn(() => 'http://localhost:4000'),
}));

import { Platform } from 'react-native';
import { getInfinitePayTapUrl } from '../src/services/infinitePayService';

describe('getInfinitePayTapUrl', () => {
  afterEach(() => {
    (Platform as any).OS = 'ios';
  });

  test('mantem installments=1 fixo para debito no iOS', () => {
    (Platform as any).OS = 'ios';
    const url = getInfinitePayTapUrl(25.5, 'debit', 'ped-1');

    expect(url).toContain('infinitepaydash://infinitetap-app?');
    expect(url).toContain('amount=2550');
    expect(url).toContain('payment_method=debit');
    expect(url).toContain('installments=1');
    expect(url).toContain('order_id=ped-1');
  });

  test('omite installments no credito iOS quando installments for null (escolha no app InfinitePay)', () => {
    (Platform as any).OS = 'ios';
    const url = getInfinitePayTapUrl(120, 'credit', 'ped-2', null);

    expect(url).toContain('infinitepaydash://infinitetap-app?');
    expect(url).toContain('amount=12000');
    expect(url).toContain('payment_method=credit');
    expect(url).not.toContain('installments=');
  });

  test('envia installments selecionado (e limita a 12) no credito iOS', () => {
    (Platform as any).OS = 'ios';
    const url3x = getInfinitePayTapUrl(90, 'credit', 'ped-3', 3);
    const urlClamped = getInfinitePayTapUrl(1200, 'credit', 'ped-4', 18);

    expect(url3x).toContain('payment_method=credit');
    expect(url3x).toContain('installments=3');
    expect(urlClamped).toContain('installments=12');
  });

  test('mantem fluxo Android inalterado', () => {
    (Platform as any).OS = 'android';
    const originalNavigator = (global as any).navigator;
    Object.defineProperty(global, 'navigator', {
      value: undefined,
      configurable: true,
    });

    const url = getInfinitePayTapUrl(50, 'credit', 'ped-5', 4);

    expect(url).toContain('infinitepay://pay?');
    expect(url).toContain('amount=5000');
    expect(url).toContain('payment_method=credit');

    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      configurable: true,
    });
  });
});
