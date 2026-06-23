import { ToastAndroid, Platform } from 'react-native';

type ToastListener = (message: string) => void;

type ConfirmOptions = {
  id?: string;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

type ConfirmListener = (
  options: Required<Omit<ConfirmOptions, 'destructive'>> & {
    destructive: boolean;
    resolve: (confirmed: boolean) => void;
  },
) => void;

let toastListener: ToastListener | undefined;
let confirmListener: ConfirmListener | undefined;
let dismissConfirmListener: ((id?: string) => void) | undefined;

const toastText = (title: string, message?: string) =>
  message ? `${title}\n${message}` : title;

export const setToastListener = (listener?: ToastListener) => {
  toastListener = listener;
};

export const setConfirmListener = (listener?: ConfirmListener) => {
  confirmListener = listener;
};

export const setDismissConfirmListener = (
  listener?: (id?: string) => void,
) => {
  dismissConfirmListener = listener;
};

export const dismissConfirm = (id?: string) => {
  dismissConfirmListener?.(id);
};

export const showToast = (title: string, message?: string) => {
  const text = toastText(title, message);
  if (Platform.OS === 'android') {
    ToastAndroid.show(text, ToastAndroid.SHORT);
  }
  toastListener?.(text);
};

export const showConfirm = (options: ConfirmOptions) =>
  new Promise<boolean>(resolve => {
    confirmListener?.({
      id: options.id || '',
      title: options.title,
      message: options.message,
      confirmText: options.confirmText || '确定',
      cancelText: options.cancelText || '取消',
      destructive: Boolean(options.destructive),
      resolve,
    });
  });
