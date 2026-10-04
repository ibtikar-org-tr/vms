import { Link, useFocusEffect } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { fetchEvents } from '@/src/api/events'
import { EmptyState, ErrorBanner, SectionTitle, StatusPill } from '@/src/components/ui'
import { colors } from '@/src/theme/colors'
import type { VmsEvent } from '@/src/types/events'
import {
  eventDescriptionPlainText,
  formatEventDateShort,
  formatEventLocation,
  isEventUpcomingOrOngoing,
} from '@/src/utils/format'

type ListItem =
  | { type: 'header'; key: string; title: string; subtitle?: string }
  | { type: 'event'; key: string; event: VmsEvent }

export default function EventsListScreen() {
  const [events, setEvents] = useState<VmsEvent[]>([])
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (refreshing = false) => {
    if (refreshing) setIsRefreshing(true)
    else setIsLoading(true)
    setError(null)

    try {
      const payload = await fetchEvents()
      setEvents(payload.events.filter((event) => event.status === 'public' || event.status === 'draft'))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذر تحميل الفعاليات.')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  const items = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const filtered = events.filter((event) => {
      if (!needle) return true
      return (
        event.name.toLowerCase().includes(needle) ||
        eventDescriptionPlainText(event.description).toLowerCase().includes(needle) ||
        formatEventLocation(event).toLowerCase().includes(needle) ||
        (event.projectName ?? '').toLowerCase().includes(needle)
      )
    })

    const upcoming = filtered
      .filter(isEventUpcomingOrOngoing)
      .sort((a, b) => {
        const aTime = a.startTime ? new Date(a.startTime).getTime() : Number.MAX_SAFE_INTEGER
        const bTime = b.startTime ? new Date(b.startTime).getTime() : Number.MAX_SAFE_INTEGER
        return aTime - bTime
      })

    const past = filtered
      .filter((event) => !isEventUpcomingOrOngoing(event))
      .sort((a, b) => {
        const aTime = a.startTime ? new Date(a.startTime).getTime() : 0
        const bTime = b.startTime ? new Date(b.startTime).getTime() : 0
        return bTime - aTime
      })

    const rows: ListItem[] = []
    if (upcoming.length > 0) {
      rows.push({
        type: 'header',
        key: 'upcoming',
        title: 'القادمة والجارية',
        subtitle: `${upcoming.length} فعالية`,
      })
      for (const event of upcoming) {
        rows.push({ type: 'event', key: event.id, event })
      }
    }
    if (past.length > 0) {
      rows.push({
        type: 'header',
        key: 'past',
        title: 'المنتهية',
        subtitle: `${past.length} فعالية`,
      })
      for (const event of past) {
        rows.push({ type: 'event', key: event.id, event })
      }
    }
    return rows
  }, [events, query])

  return (
    <View style={styles.flex}>
      <View style={styles.searchWrap}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="ابحث بالاسم أو الموقع أو المشروع..."
          placeholderTextColor={colors.textMuted}
          style={styles.search}
        />
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void load(true)} />}
          ListHeaderComponent={error ? <ErrorBanner message={error} /> : null}
          ListEmptyComponent={!error ? <EmptyState message="لا توجد فعاليات حالياً." /> : null}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return <SectionTitle title={item.title} subtitle={item.subtitle} />
            }

            const event = item.event
            const upcoming = isEventUpcomingOrOngoing(event)

            return (
              <Link href={`/events/${event.id}`} asChild>
                <Pressable style={styles.card}>
                  <View style={styles.banner}>
                    {event.imageUrl ? (
                      <Image source={{ uri: event.imageUrl }} style={styles.bannerImage} />
                    ) : (
                      <View style={styles.bannerFallback} />
                    )}
                    <View style={styles.bannerOverlay}>
                      <StatusPill label={upcoming ? 'قادمة' : 'منتهية'} tone={upcoming ? 'success' : 'neutral'} />
                      <Text style={styles.bannerDate}>{formatEventDateShort(event.startTime)}</Text>
                      <Text style={styles.bannerTitle} numberOfLines={2}>
                        {event.name}
                      </Text>
                      <Text style={styles.bannerMeta} numberOfLines={1}>
                        {formatEventLocation(event)}
                      </Text>
                    </View>
                  </View>
                  {eventDescriptionPlainText(event.description) ? (
                    <Text style={styles.description} numberOfLines={2}>
                      {eventDescriptionPlainText(event.description)}
                    </Text>
                  ) : null}
                  {event.projectName ? <Text style={styles.project}>{event.projectName}</Text> : null}
                </Pressable>
              </Link>
            )
          }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  searchWrap: { paddingHorizontal: 16, paddingTop: 12 },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    textAlign: 'right',
    color: colors.text,
    fontSize: 15,
  },
  list: { padding: 16, gap: 12, paddingBottom: 32 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  banner: {
    height: 148,
    backgroundColor: '#e2e8f0',
  },
  bannerImage: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  bannerFallback: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#cffafe',
  },
  bannerOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    padding: 14,
    justifyContent: 'flex-end',
    gap: 4,
  },
  bannerDate: {
    color: '#e2e8f0',
    fontSize: 12,
    textAlign: 'right',
  },
  bannerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'right',
  },
  bannerMeta: {
    color: '#cbd5e1',
    fontSize: 12,
    textAlign: 'right',
  },
  description: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'right',
  },
  project: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
})
