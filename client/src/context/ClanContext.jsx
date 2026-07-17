/**
 * ClanContext
 *
 * Single source of truth for live clan data from the COC API.
 * Fetches the configured clan (from backend's COC_CLAN_TAG env var)
 * on app load, exposes clan info + members + war log.
 *
 * Replaces all the hardcoded mockClan data.
 *
 * Falls back to a safe placeholder if the backend isn't running or
 * the API call fails, so the UI never crashes.
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { cocApi } from '../services/cocApi.js'

const ClanContext = createContext({
  clan: null,          // { name, tag, clanLevel, members, badgeUrls, ... }
  clanTag: '',         // e.g. '#2G9Y2GGPJ'
  members: [],         // Array of clan members from COC
  warLog: [],          // Recent war results
  warError: null,      // Specific error string for war-log loading (e.g. private)
  loading: true,
  error: null,
  refresh: () => {},
})

export function ClanProvider({ children }) {
  const [clan, setClan] = useState(null)
  const [members, setMembers] = useState([])
  const [warLog, setWarLog] = useState([])
  const [warError, setWarError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [clanTag, setClanTag] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Step 1: get the configured clan tag from the backend config.
      // If the /test endpoint is unreachable (e.g. Render cold start,
      // CORS issue, or offline), fall back to fetching the clan directly
      // — the backend defaults to its own COC_CLAN_TAG env var.
      let tag = ''
      try {
        const meta = await cocApi.getTest()
        tag = meta?.coc_clan_tag || ''
      } catch {
        // /test endpoint may not be reachable — try without explicit tag
      }

      // If we got a tag from /test, use it. Otherwise fetch without a tag
      // (backend will use its configured default).
      if (tag) setClanTag(tag)

      // Step 2: fetch live clan data + members + war log in parallel.
      // If no explicit tag, use 'default' — the backend will resolve to
      // the COC_CLAN_TAG from its own .env.
      const fetchTag = tag || 'default'
      const [clanData, membersData, warLogResult] = await Promise.allSettled([
        cocApi.getClan(fetchTag),
        cocApi.getClanMembers(fetchTag),
        cocApi.getWarLog(fetchTag)
      ])

      if (clanData.status === 'fulfilled') {
        setClan(clanData.value)
        // If we didn't get the tag from /test, extract it from the clan data
        if (!tag && clanData.value?.tag) setClanTag(clanData.value.tag)
      }
      else throw clanData.reason

      setMembers(
        membersData.status === 'fulfilled' ? (membersData.value.items || []) : []
      )

      if (warLogResult.status === 'fulfilled') {
        setWarLog(warLogResult.value.items || [])
        setWarError(null)
      } else {
        setWarLog([])
        const msg = warLogResult.reason?.message || 'Failed to load war log'
        // 403 from the COC API usually means the clan's war log is set to Private in-game.
        if (/403|forbidden|not authorized/i.test(msg)) {
          setWarError('War log is private. Ask the clan leader to set War Log → Public in clan settings.')
        } else {
          setWarError(msg)
        }
      }
    } catch (e) {
      setError(e.message || 'Failed to load clan data')
      // Keep placeholder so UI doesn't crash
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch on mount
  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <ClanContext.Provider
      value={{
        clan,
        clanTag,
        members,
        warLog,
        warError,
        loading,
        error,
        refresh
      }}
    >
      {children}
    </ClanContext.Provider>
  )
}

export const useClan = () => useContext(ClanContext)

export default ClanContext