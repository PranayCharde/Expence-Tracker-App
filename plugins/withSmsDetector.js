const { withAndroidManifest } = require('@expo/config-plugins');

const withSmsDetector = (config) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;

    // 1. Ensure uses-permission array exists
    if (!androidManifest['uses-permission']) {
      androidManifest['uses-permission'] = [];
    }

    const permissions = [
      'android.permission.RECEIVE_SMS',
      'android.permission.READ_SMS'
    ];

    permissions.forEach((perm) => {
      const exists = androidManifest['uses-permission'].some(
        (p) => p.$?.['android:name'] === perm
      );
      if (!exists) {
        androidManifest['uses-permission'].push({
          $: { 'android:name': perm }
        });
      }
    });

    // 2. Add BroadcastReceiver inside <application>
    const application = androidManifest.application?.[0];
    if (application) {
      if (!application.receiver) {
        application.receiver = [];
      }

      const receiverName = 'com.pranay.spendwise.sms.SmsBroadcastReceiver';
      const receiverExists = application.receiver.some(
        (r) => r.$?.['android:name'] === receiverName
      );

      if (!receiverExists) {
        application.receiver.push({
          $: {
            'android:name': receiverName,
            'android:exported': 'true',
            'android:permission': 'android.permission.BROADCAST_SMS'
          },
          'intent-filter': [
            {
              $: {
                'android:priority': '999'
              },
              action: [
                {
                  $: {
                    'android:name': 'android.provider.Telephony.SMS_RECEIVED'
                  }
                }
              ]
            }
          ]
        });
      }
    }

    return config;
  });
};

module.exports = withSmsDetector;

