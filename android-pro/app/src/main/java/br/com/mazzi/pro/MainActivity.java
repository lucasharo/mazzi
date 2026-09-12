package br.com.mazzi.pro;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onResume() {
        super.onResume();
        InstantOfferMessagingService.dismissDeliveredOffers(this);
    }
}
