package br.com.mazzi.pro;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/** Renders actionable Aula Agora offers while another app is in the foreground. */
public final class InstantOfferMessagingService extends FirebaseMessagingService {
    private static final String EVENT_INSTANT_OFFER = "INSTANT_LESSON_OFFER";
    private static final String CHANNEL_ID = "instant-offers";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        Map<String, String> data = message.getData();
        if (!EVENT_INSTANT_OFFER.equals(data.get("eventType"))) return;
        String offerId = data.get("entityId");
        if (offerId == null || offerId.trim().isEmpty()) return;

        createChannel();
        int notificationId = Math.abs(offerId.hashCode());
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_mazzi_location)
            .setContentTitle(valueOr(data.get("title"), "Nova Aula Agora"))
            .setContentText(valueOr(data.get("body"), "Há uma solicitação de aula próxima para você avaliar."))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_EVENT)
            .setAutoCancel(true)
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
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    private String valueOr(String value, String fallback) {
        return value == null || value.trim().isEmpty() ? fallback : value;
    }
}
