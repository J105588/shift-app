type AlertConfig = {
  message: string;
  type: 'alert' | 'confirm';
  resolve: (value: boolean) => void;
} | null;

let alertCallback: ((config: AlertConfig) => void) | null = null;

export const registerAlertHandler = (handler: ((config: AlertConfig) => void) | null) => {
  alertCallback = handler;
};

export const customAlert = (message: string): Promise<void> => {
  return new Promise((resolve) => {
    if (alertCallback) {
      alertCallback({
        message,
        type: 'alert',
        resolve: () => resolve(),
      });
    } else {
      // クライアントサイドでのフォールバック
      if (typeof window !== 'undefined') {
        window.alert(message);
      }
      resolve();
    }
  });
};

export const customConfirm = (message: string): Promise<boolean> => {
  return new Promise((resolve) => {
    if (alertCallback) {
      alertCallback({
        message,
        type: 'confirm',
        resolve,
      });
    } else {
      // クライアントサイドでのフォールバック
      if (typeof window !== 'undefined') {
        resolve(window.confirm(message));
      } else {
        resolve(false);
      }
    }
  });
};
