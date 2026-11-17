import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

/**
 * Navigate to a route from anywhere in the app (e.g., background SMS service, notifications)
 * @param {string} name - Route name
 * @param {object} params - Route params
 */
export function navigate(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  } else {
    // Retry shortly if navigation container is still mounting
    setTimeout(() => {
      if (navigationRef.isReady()) {
        navigationRef.navigate(name, params);
      }
    }, 500);
  }
}

export default {
  navigationRef,
  navigate
};

