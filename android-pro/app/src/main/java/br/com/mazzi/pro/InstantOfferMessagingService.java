package br.com.mazzi.pro;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/** Renders actionable Aula Agora offers while another app is in the foreground. */
public final class InstantOfferMessagingService extends FirebaseMessagingService {
    private static final String EVENT_INSTANT_OFFER = "INSTANT_LESSON_OFFER";
    private static final String CHANNEL_ID = "instant-offers-v2";
    private static final String PREFS = "instant_offer_notifications";
    private static final String PREF_IDS = "ids";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        Map<String, String> data = message.getData();
        if (!EVENT_INSTANT_OFFER.equals(data.get("eventType"))) return;
        String offerId = data.get("entityId");
        if (offerId == null || offerId.trim().isEmpty()) return;

        createChannel();
        int notificationId = Math.abs(offerId.hashCode());
        rememberNotificationId(notificationId);
        int timeoutSeconds = parseTimeoutSeconds(data.get("expiresInSeconds"));
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_mazzi_location)
            .setContentTitle(valueOr(data.get("title"), "Nova Aula Agora"))
            .setContentText(valueOr(data.get("body"), "Há uma solicitação de aula próxima para você avaliar."))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_EVENT)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setVibrate(new long[] { 0, 350, 250, 350 })
            .setAutoCancel(true)
            .setTimeoutAfter(timeoutSeconds * 1_000L)
            .setContentIntent(actionIntent(offerId, "OPEN", notificationId));

        builder.addAction(new NotificationCompat.Action.Builder(
            R.drawable.ic_stat_mazzi_location,
            "Aceitar",
            actionIntent(offerId, "ACCEPT", notificationId + 1)
        ).build());
        builder.addAction(new NotificationCompat.Action.Builder(
            R.drawable.ic_stat_mazzi_location,
            "Recusar",
            actionIntent(offerId, "DECLINE", notificationId + 2)
        ).build());

        NotificationManagerCompat.from(this).notify(notificationId, builder.build());
    }

    /** Removes pending Aula Agora notifications when the PRO activity becomes visible. */
    public static void dismissDeliveredOffers(Context context) {
        Set<String> stored = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getStringSet(PREF_IDS, new HashSet<>());
        for (String rawId : new HashSet<>(stored)) {
            try {
                NotificationManagerCompat.from(context).cancel(Integer.parseInt(rawId));
            } catch (NumberFormatException ignored) {
                // Ignore a corrupted id and continue clearing the rest.
            }
        }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(PREF_IDS).apply();
    }

    private void rememberNotificationId(int notificationId) {
        Set<String> current = new HashSet<>(getSharedPreferences(PREFS, MODE_PRIVATE)
            .getStringSet(PREF_IDS, new HashSet<>()));
        current.add(String.valueOf(notificationId));
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putStringSet(PREF_IDS, current).apply();
    }

    private int parseTimeoutSeconds(String rawValue) {
        try {
            int seconds = Integer.parseInt(rawValue == null ? "" : rawValue);
            return Math.max(1, Math.min(seconds, 120));
        } catch (NumberFormatException ignored) {
            return 60;
        }
    }

    private PendingIntent actionIntent(String offerId, String action, int requestCode) {
        Uri uri = Uri.parse("mazzi://instant-offer-action?offer_id=" + Uri.encode(offerId) + "&action=" + Uri.encode(action));
        Intent intent = new Intent(Intent.ACTION_VIEW, uri, this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(this, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Ofertas Aula Agora",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Ofertas urgentes para o profissional aceitar ou recusar");
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[] { 0, 350, 250, 350 });
        channel.setSound(Settings.System.DEFAULT_NOTIFICATION_URI,
            new android.media.AudioAttributes.Builder()
                .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build());
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    private String valueOr(String value, String fallback) {
        return value == null || value.trim().isEmpty() ? fallback : value;
    }
}
