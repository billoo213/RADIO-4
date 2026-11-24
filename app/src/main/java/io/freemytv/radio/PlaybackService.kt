package io.freemytv.radio

import android.app.PendingIntent
import android.content.Intent
import android.os.Handler
import android.os.Looper
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService

/** Lecture en arrière-plan : ExoPlayer + notification média (gérée par Media3). */
class PlaybackService : MediaSessionService() {

    private var session: MediaSession? = null

    override fun onCreate() {
        super.onCreate()
        val player = ExoPlayer.Builder(this)
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(C.USAGE_MEDIA)
                    .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                    .build(),
                true
            )
            .setHandleAudioBecomingNoisy(true)
            .setWakeMode(C.WAKE_MODE_NETWORK)
            .build()
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        session = MediaSession.Builder(this, player).setSessionActivity(open).build()
        instance = this
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = session

    override fun onTaskRemoved(rootIntent: Intent?) {
        val p = session?.player
        if (p == null || !p.playWhenReady || p.mediaItemCount == 0) stopSelf()
    }

    override fun onDestroy() {
        instance = null
        session?.let {
            it.player.release()
            it.release()
        }
        session = null
        super.onDestroy()
    }

    companion object {
        private var instance: PlaybackService? = null
        private val handler = Handler(Looper.getMainLooper())
        private val stopper = Runnable {
            instance?.session?.player?.let {
                it.stop()
                it.clearMediaItems()
            }
        }

        /** Minuterie de sommeil : arrête la radio dans [minutes] minutes (0 = annule). */
        fun sleepIn(minutes: Int) {
            handler.removeCallbacks(stopper)
            if (minutes > 0) handler.postDelayed(stopper, minutes * 60_000L)
        }
    }
}
