import { useAuth } from '../context/AuthContext.jsx'
import Avatar from '../components/ui/Avatar.jsx'
import RoleBadge from '../components/ui/RoleBadge.jsx'
import Badge from '../components/ui/Badge.jsx'
import StatCard from '../components/ui/StatCard.jsx'
import { Gift, Swords, Trophy, Star, Link2, Copy, CheckCircle2, Hash, Camera, Loader2, X, KeyRound, ExternalLink, ChevronRight } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { cocApi } from '../services/cocApi.js'

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth()
  const [copied, setCopied] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [editName, setEditName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  // COC linking state — 2-step (tag → token → verify)
  const [linking, setLinking] = useState(false)
  const [linkStep, setLinkStep] = useState(1) // 1 = tag, 2 = token
  const [tagInput, setTagInput] = useState('')
  const [tokenInput, setTokenInput] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [pendingPlayer, setPendingPlayer] = useState(null) // player data after tag check

  // Pull COC data from the profile row (set during COC login)
  const cocTag   = profile?.coc_player_tag
  const cocName  = profile?.coc_player_name
  const cocTH    = profile?.coc_town_hall
  const cocTroph = profile?.coc_trophies
  const cocVerif = profile?.coc_verified

  // Onboarding auto-open: if user arrives with ?onboard=1, open the
  // linking form automatically. The OnboardingGate sends users here
  // when they need to link their COC account.
  const [searchParams] = useSearchParams()
  useEffect(() => {
    if (searchParams.get('onboard') === '1' && !cocVerif) {
      setLinking(true)
      setLinkStep(1)
    }
  }, [searchParams, cocVerif])

  // Placeholders for stats that aren't yet wired to the backend
  const placeholderStats = {
    warStars: 0,
    donations: 0,
    donationsReceived: 0,
    clanRole: 'member',
    bestTrophies: cocTroph || 0
  }

  const handleCopyTag = () => {
    if (!cocTag) return
    navigator.clipboard.writeText(cocTag)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Avatar upload ──────────────────────────────────────────
  const handleAvatarClick = () => fileRef.current?.click()

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = '' // reset so same file can be re-selected

    // Validate
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be under 2MB')
      return
    }

    setError(null)
    setUploading(true)

    try {
      const ext = file.name.split('.').pop()
      const path = `${user.id}/avatar.${ext}`

      // Upload to Supabase Storage 'avatars' bucket
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })
      if (upErr) throw upErr

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(path)

      // Cache-bust so the browser fetches the new image
      const avatarUrl = `${publicUrl}?t=${Date.now()}`

      // Save URL to profile
      const { error: dbErr } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id)
      if (dbErr) throw dbErr

      await refreshProfile()
    } catch (err) {
      setError(err.message || 'Failed to upload image')
    } finally {
      setUploading(false)
    }
  }

  // ── Display name save ──────────────────────────────────────
  const handleSaveName = async () => {
    if (!nameInput.trim()) return
    setSavingName(true)
    setError(null)
    try {
      const { error: dbErr } = await supabase
        .from('profiles')
        .update({ display_name: nameInput.trim() })
        .eq('id', user.id)
      if (dbErr) throw dbErr
      await refreshProfile()
      setEditName(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingName(false)
    }
  }

  const startEditName = () => {
    setNameInput(displayName)
    setEditName(true)
  }

  // ── COC linking (2-step) ───────────────────────────────────
  // Step 1: Enter player tag → we GET the player to confirm it exists
  //         and pre-fill their name + TH level.
  // Step 2: User gets the in-game API token from their COC settings
  //         (Settings → More Settings → API Token) and pastes it here.
  //         We POST to verifytoken to PROVE they own the account.
  // Only then do we mark coc_verified = true and persist player data.

  // Reset everything when opening the linking form
  const openLinking = () => {
    setLinking(true)
    setLinkStep(1)
    setTagInput('')
    setTokenInput('')
    setPendingPlayer(null)
    setError(null)
  }

  const closeLinking = () => {
    setLinking(false)
    setLinkStep(1)
    setTagInput('')
    setTokenInput('')
    setPendingPlayer(null)
    setError(null)
  }

  // Step 1: Look up the player
  const handleTagSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    const normalizedTag = tagInput.trim().toUpperCase().replace(/^#?/, '#')
    if (!/^#[A-Z0-9]{4,12}$/.test(normalizedTag)) {
      setError('Tag should look like #P8L8Y0QJ (5-12 alphanumeric chars after #).')
      return
    }

    setVerifying(true)
    try {
      const player = await cocApi.getPlayer(normalizedTag)
      if (!player?.tag) throw new Error('Player not found. Double-check the tag.')
      setPendingPlayer(player)
      setLinkStep(2)
    } catch (err) {
      setError(err.message || 'Could not look up the player. Make sure the backend is running.')
    } finally {
      setVerifying(false)
    }
  }

  // Step 2: Verify token + save to profile
  const handleTokenSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    const token = tokenInput.trim()
    if (!token) {
      setError('Paste the API token from your COC game settings.')
      return
    }

    setVerifying(true)
    try {
      // 1. Verify ownership via the official Supercell endpoint
      const result = await cocApi.verifyPlayerToken(pendingPlayer.tag, token)
      if (result.status !== 'ok') {
        throw new Error(
          result.status === 'expired'
            ? 'Token expired. Generate a new one in your COC settings (tokens last 15 min).'
            : 'Token is invalid. Make sure you copied the whole token from your game settings.'
        )
      }

      // 2. Save to profile (now legitimately verified)
      const { error: dbErr } = await supabase
        .from('profiles')
        .update({
          coc_player_tag: pendingPlayer.tag,
          coc_player_name: pendingPlayer.name,
          coc_town_hall: pendingPlayer.townHallLevel,
          coc_trophies: pendingPlayer.trophies,
          coc_verified: true,
          coc_verified_at: new Date().toISOString(),
          coc_linked_at: new Date().toISOString(),
          // Auto-fill display name on first link if it's still a default
          ...(displayName === 'Member' || displayName === 'New Member'
            ? { display_name: pendingPlayer.name }
            : {})
        })
        .eq('id', user.id)
      if (dbErr) throw dbErr

      await refreshProfile()
      closeLinking()
    } catch (err) {
      setError(err.message || 'Verification failed. Please try again.')
    } finally {
      setVerifying(false)
    }
  }

  const handleUnlink = async () => {
    if (!window.confirm('Unlink your COC account? Your game stats will be removed from this profile.')) return
    setError(null)
    try {
      const { error: dbErr } = await supabase
        .from('profiles')
        .update({
          coc_player_tag: null,
          coc_player_name: null,
          coc_town_hall: null,
          coc_trophies: null,
          coc_verified: false,
          coc_verified_at: null,
          coc_linked_at: null
        })
        .eq('id', user.id)
      if (dbErr) throw dbErr
      await refreshProfile()
    } catch (err) {
      setError(err.message)
    }
  }

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Member'

  return (
    <div className="page-container space-y-6">
      <h1 className="page-title">My Profile</h1>

      {/* Error banner */}
      {error && (
        <div className="text-xs text-red-300 bg-red-900/20 border border-red-700/50 rounded-lg p-2 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="btn-ghost !p-1">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Profile header */}
      <div className="card">
        <div className="flex flex-col md:flex-row items-start gap-4">
          {/* Avatar with upload overlay */}
          <div className="relative group shrink-0">
            <Avatar src={profile?.avatar_url} size="xl" fallback={displayName[0]} />
            <button
              onClick={handleAvatarClick}
              disabled={uploading}
              className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white disabled:opacity-70"
              title="Change profile picture"
            >
              {uploading
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : <Camera className="w-5 h-5" />}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {editName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="input !py-1 !w-auto"
                    autoFocus
                    maxLength={32}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName()
                      if (e.key === 'Escape') setEditName(false)
                    }}
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={savingName}
                    className="btn-primary !px-3 !py-1"
                  >
                    {savingName ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditName(false)}
                    className="btn-ghost !px-2 !py-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={startEditName}
                  className="group flex items-center gap-2"
                  title="Click to edit name"
                >
                  <h2 className="text-xl font-bold">{displayName}</h2>
                  <span className="opacity-0 group-hover:opacity-100 text-clan-muted text-xs">
                    ✏️ edit
                  </span>
                </button>
              )}
              <RoleBadge role={placeholderStats.clanRole} />
              {cocVerif && (
                <Badge variant="success">
                  <CheckCircle2 className="w-3 h-3" /> COC Verified
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              {cocTag ? (
                <>
                  <Hash className="w-3 h-3 text-clan-accent" />
                  <span className="text-sm font-mono text-clan-text">{cocTag}</span>
                  <button
                    onClick={handleCopyTag}
                    className="btn-ghost !p-1"
                    title="Copy player tag"
                  >
                    {copied
                      ? <CheckCircle2 className="w-3 h-3 text-clan-success" />
                      : <Copy className="w-3 h-3" />}
                  </button>
                </>
              ) : (
                <span className="text-sm text-clan-muted">No COC account linked</span>
              )}
            </div>
            <p className="text-sm text-clan-muted mt-2">
              Platform: {user?.email || 'Not signed in'}
            </p>
          </div>
          {cocTH && (
            <div className="flex flex-col items-center gap-1">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-clan-accent to-clan-gold-dark flex items-center justify-center shadow-lg shadow-clan-accent/30">
                <span className="text-2xl font-bold text-clan-darker">TH{cocTH}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={Trophy}
          label="Current Trophies"
          value={cocTroph || '—'}
          color="text-clan-gold"
        />
        <StatCard
          icon={Star}
          label="War Stars"
          value={placeholderStats.warStars}
          color="text-clan-primary"
        />
        <StatCard
          icon={Gift}
          label="Donations"
          value={placeholderStats.donations}
          color="text-clan-elixir"
        />
        <StatCard
          icon={Trophy}
          label="Best Trophies"
          value={placeholderStats.bestTrophies || '—'}
          color="text-clan-success"
        />
      </div>

      {/* COC account section */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <Swords className="w-5 h-5 text-clan-accent" />
          <h2 className="section-title !mb-0">Clash of Clans Account</h2>
        </div>
        {cocVerif && cocTag ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-900/20 border border-green-700">
              <div>
                <p className="text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-clan-success" />
                  {cocName || 'Account verified'}
                </p>
                <p className="text-xs text-clan-muted mt-0.5 font-mono">
                  {cocTag} {cocTH && <>· TH {cocTH}</>} {cocTroph != null && <>· 🏆 {cocTroph}</>}
                </p>
              </div>
              <Badge variant="success">Linked</Badge>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={openLinking}
                className="btn-secondary text-xs"
              >
                <Link2 className="w-3 h-3" /> Re-link
              </button>
              <button
                onClick={handleUnlink}
                className="btn-ghost text-xs text-clan-danger"
              >
                Unlink
              </button>
            </div>
            <p className="text-xs text-clan-muted">
              Your in-game stats sync when you link. This connects your Supercell account — no Google or Discord needed.
            </p>
          </div>
        ) : linking ? (
          // ── 2-step linking wizard ───────────────────────
          <div className="space-y-4">
            {/* Step indicator */}
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                linkStep === 1 ? 'bg-clan-accent text-clan-darker' : 'bg-clan-surface text-clan-muted'
              }`}>
                <span className="w-4 h-4 rounded-full bg-clan-darker text-clan-accent flex items-center justify-center text-[10px] font-bold">1</span>
                Player tag
              </div>
              <ChevronRight className="w-4 h-4 text-clan-muted" />
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                linkStep === 2 ? 'bg-clan-accent text-clan-darker' : 'bg-clan-surface text-clan-muted'
              }`}>
                <span className="w-4 h-4 rounded-full bg-clan-darker text-clan-accent flex items-center justify-center text-[10px] font-bold">2</span>
                API token
              </div>
            </div>

            {linkStep === 1 ? (
              // ── STEP 1: Player tag ───────────────────────
              <form onSubmit={handleTagSubmit} className="space-y-3">
                <p className="text-sm text-clan-muted">
                  Step 1 of 2 — Enter your in-game player tag.
                </p>
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value.toUpperCase())}
                  placeholder="#YOURTAG"
                  className="input font-mono uppercase"
                  autoFocus
                  spellCheck={false}
                  disabled={verifying}
                />
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={verifying || !tagInput.trim()}
                    className="btn-primary"
                  >
                    {verifying
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Looking up...</>
                      : <>Continue <ChevronRight className="w-4 h-4" /></>}
                  </button>
                  <button
                    type="button"
                    onClick={closeLinking}
                    className="btn-ghost"
                    disabled={verifying}
                  >
                    Cancel
                  </button>
                </div>
                <p className="text-xs text-clan-muted">
                  Find your tag in-game: <span className="text-clan-text">Profile → tap your name</span>
                </p>
              </form>
            ) : (
              // ── STEP 2: API token ────────────────────────
              <form onSubmit={handleTokenSubmit} className="space-y-3">
                {/* Player preview */}
                {pendingPlayer && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-clan-surface border border-clan-border">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-clan-accent to-clan-gold-dark flex items-center justify-center text-clan-darker font-bold text-xs">
                      TH{pendingPlayer.townHallLevel}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{pendingPlayer.name}</p>
                      <p className="text-xs text-clan-muted font-mono">{pendingPlayer.tag} · 🏆 {pendingPlayer.trophies}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setLinkStep(1); setTokenInput(''); setError(null) }}
                      className="btn-ghost !p-1 text-xs"
                    >
                      Change
                    </button>
                  </div>
                )}

                <p className="text-sm text-clan-muted">
                  Step 2 of 2 — Generate an API token in-game and paste it here to prove you own this account.
                </p>

                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-clan-muted" />
                  <input
                    type="text"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value.trim())}
                    placeholder="Paste your API token"
                    className="input pl-9 font-mono text-xs"
                    autoFocus
                    spellCheck={false}
                    disabled={verifying}
                  />
                </div>

                {/* How-to instructions */}
                <details className="text-xs text-clan-muted">
                  <summary className="cursor-pointer hover:text-clan-text font-medium">
                    How do I get my API token?
                  </summary>
                  <ol className="mt-2 space-y-1 pl-4 list-decimal">
                    <li>Open Clash of Clans on your device</li>
                    <li>Tap the gear icon → <span className="text-clan-text">More Settings</span></li>
                    <li>Scroll down → tap <span className="text-clan-text">API Token</span></li>
                    <li>Tap <span className="text-clan-text">Generate Token</span> (or "Show" if you have one)</li>
                    <li>Copy it and paste here</li>
                  </ol>
                  <p className="mt-2 text-[10px] text-clan-muted">
                    ⚠️ Tokens expire after 15 minutes and work only once. Generate a fresh one if needed.
                  </p>
                </details>

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={verifying || !tokenInput.trim()}
                    className="btn-primary"
                  >
                    {verifying
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying ownership...</>
                      : <><KeyRound className="w-4 h-4" /> Verify & Link</>}
                  </button>
                  <button
                    type="button"
                    onClick={closeLinking}
                    className="btn-ghost"
                    disabled={verifying}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-clan-muted">
              Link your Clash of Clans account to unlock live stats, war tracking, and donation leaderboards.
              We verify your tag directly through the official Supercell API.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={openLinking}
                className="btn-primary w-fit"
              >
                <Link2 className="w-4 h-4" /> Link COC Account
              </button>
              <p className="text-xs text-clan-muted">
                Find your tag in-game: <span className="text-clan-text">Profile → tap your name</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Badges / Achievements placeholder */}
      <div className="card">
        <h2 className="section-title">Badges & Achievements</h2>
        <div className="flex items-center justify-center py-8 text-clan-muted text-sm">
          <Swords className="w-8 h-8 mr-2 opacity-50" />
          Earn badges by participating in wars, donating, and engaging with the clan!
        </div>
      </div>
    </div>
  )
}