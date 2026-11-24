package io.freemytv.radio

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.ComponentName
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.content.ContextCompat
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.ListenableFuture
import org.json.JSONObject

/** L'interface (HTML) dans une WebView ; la lecture passe par le service de lecture natif. */
class MainActivity : Activity() {

    private lateinit var web: WebView
    private val main = Handler(Looper.getMainLooper())
    private var future: ListenableFuture<MediaController>? = null
    private var controller: MediaController? = null
    private var pending: (() -> Unit)? = null

    private val listener = object : Player.Listener {
        override fun onIsPlayingChanged(isPlaying: Boolean) = push(null)
        override fun onPlaybackStateChanged(playbackState: Int) = push(null)
        override fun onMediaMetadataChanged(mediaMetadata: MediaMetadata) = push(null)
        override fun onPlayerError(error: PlaybackException) = push(error.errorCodeName)
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        web = WebView(this)
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.settings.mediaPlaybackRequiresUserGesture = false
        web.setBackgroundColor(Color.BLACK)
        web.webViewClient = object : WebViewClient() {
            @Deprecated("Deprecated in Java")
            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean = !url.startsWith("file:")
        }
        web.addJavascriptInterface(Bridge(), "Android")
        setContentView(web)
        web.loadUrl("file:///android_asset/www/index.html")
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
        }
    }

    override fun onStart() {
        super.onStart()
        val token = SessionToken(this, ComponentName(this, PlaybackService::class.java))
        val f = MediaController.Builder(this, token).buildAsync()
        future = f
        f.addListener({
            try {
                val c = f.get()
                controller = c
                c.addListener(listener)
                pending?.invoke()
                pending = null
                push(null)
            } catch (e: Exception) {
                push("CONTROLLER")
            }
        }, ContextCompat.getMainExecutor(this))
    }

    override fun onStop() {
        future?.let { MediaController.releaseFuture(it) }
        future = null
        controller = null
        super.onStop()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        web.evaluateJavascript("(window.onBack ? window.onBack() : false)") { r ->
            if (r != "true") moveTaskToBack(true)   // la radio continue en arrière-plan
        }
    }

    private fun whenReady(action: () -> Unit) {
        if (controller != null) action() else pending = action
    }

    /** Envoie l'état du lecteur à la page : { playing, loading, idle, url, title, station, error }. */
    private fun push(error: String?) {
        val o = JSONObject()
        controller?.let { c ->
            o.put("playing", c.isPlaying)
            o.put("loading", c.playbackState == Player.STATE_BUFFERING)
            o.put("idle", c.mediaItemCount == 0 || c.playbackState == Player.STATE_IDLE)
            o.put("url", c.currentMediaItem?.localConfiguration?.uri?.toString() ?: "")
            o.put("title", c.mediaMetadata.title?.toString() ?: "")
            o.put("station", c.mediaMetadata.artist?.toString() ?: "")
        }
        if (error != null) o.put("error", error)
        web.evaluateJavascript("window.onNative && window.onNative(" + o.toString() + ")", null)
    }

    inner class Bridge {
        @JavascriptInterface
        fun play(url: String, name: String) {
            main.post {
                whenReady {
                    val c = controller ?: return@whenReady
                    val meta = MediaMetadata.Builder().setTitle(name).setArtist(name).build()
                    c.setMediaItem(MediaItem.Builder().setUri(url).setMediaMetadata(meta).build())
                    c.prepare()
                    c.play()
                }
            }
        }

        @JavascriptInterface
        fun pause() { main.post { controller?.pause() } }

        @JavascriptInterface
        fun resume() { main.post { controller?.let { it.prepare(); it.play() } } }

        @JavascriptInterface
        fun stop() {
            main.post {
                controller?.let {
                    it.stop()
                    it.clearMediaItems()
                }
            }
        }

        @JavascriptInterface
        fun sleep(minutes: Int) { main.post { PlaybackService.sleepIn(minutes) } }

        @JavascriptInterface
        fun keepAwake(on: Boolean) {
            main.post {
                if (on) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            }
        }

        /** Couleur des barres du système, accordée au thème de la page. */
        @JavascriptInterface
        fun setTheme(night: Boolean) {
            main.post {
                val bg = if (night) Color.parseColor("#0B0B0D") else Color.parseColor("#F2F2F5")
                window.statusBarColor = bg
                window.navigationBarColor = bg
                var flags = window.decorView.systemUiVisibility
                flags = if (night) {
                    flags and View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR.inv()
                } else {
                    flags or View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
                }
                window.decorView.systemUiVisibility = flags
            }
        }
    }
}
