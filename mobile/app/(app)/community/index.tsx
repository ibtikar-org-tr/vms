import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import {
  createPositionApplication,
  fetchLeaderboard,
  fetchOpenPositions,
  selfCancelPositionApplication,
} from '@/src/api/community'
import { useAuth } from '@/src/auth/AuthContext'
import { EmptyState, ErrorBanner, SearchField, SectionTitle, StatusPill } from '@/src/components/ui'
import { colors } from '@/src/theme/colors'
import type {
  VmsLeaderboardEntry,
  VmsLeaderboardViewer,
  VmsPosition,
} from '@/src/types/community'

function applicationStatusLabel(status: string) {
  if (status === 'pending') return 'قيد المراجعة'
  if (status === 'accepted') return 'مقبول'
  if (status === 'rejected') return 'مرفوض'
  return status
}

function applicationTone(status: string): 'warning' | 'success' | 'danger' | 'neutral' {
  if (status === 'pending') return 'warning'
  if (status === 'accepted') return 'success'
  if (status === 'rejected') return 'danger'
  return 'neutral'
}

export default function CommunityScreen() {
  const { user } = useAuth()
  const router = useRouter()
  const [entries, setEntries] = useState<VmsLeaderboardEntry[]>([])
  const [viewer, setViewer] = useState<VmsLeaderboardViewer | null>(null)
  const [positions, setPositions] = useState<VmsPosition[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [motivationDraft, setMotivationDraft] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const load = useCallback(async (refreshing = false) => {
    if (refreshing) setIsRefreshing(true)
    else setIsLoading(true)
    setError(null)

    try {
      const [leaderboardPayload, positionsPayload] = await Promise.all([
        fetchLeaderboard(),
        fetchOpenPositions(),
      ])
      setEntries(leaderboardPayload.entries)
      setViewer(leaderboardPayload.viewer)
      setPositions(positionsPayload.positions)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذر تحميل المجتمع.')
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

  const viewerRank = useMemo(() => {
    const index = entries.findIndex((entry) => entry.isViewer)
    if (index >= 0) return index + 1
    return viewer?.rank ?? null
  }, [entries, viewer])

  const topThree = useMemo(() => entries.slice(0, 3), [entries])
  const restEntries = useMemo(() => entries.slice(3), [entries])

  const { applied, available } = useMemo(() => {
    const membershipNumber = user?.membershipNumber
    const appliedList: VmsPosition[] = []
    const availableList: VmsPosition[] = []

    for (const position of positions) {
      const mine = membershipNumber
        ? position.applications.find((application) => application.membershipNumber === membershipNumber)
        : undefined
      if (mine) appliedList.push(position)
      else availableList.push(position)
    }

    return { applied: appliedList, available: availableList }
  }, [positions, user?.membershipNumber])

  const filteredAvailable = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return available
    return available.filter(
      (position) =>
        position.name.toLowerCase().includes(query) ||
        (position.projectName ?? '').toLowerCase().includes(query) ||
        (position.description ?? '').toLowerCase().includes(query),
    )
  }, [available, searchQuery])

  const handleApply = async (positionId: string) => {
    setApplyError(null)
    setApplyingId(positionId)

    try {
      const motivationLetter = motivationDraft[positionId]?.trim()
      const { positionApplication } = await createPositionApplication(positionId, {
        motivationLetter: motivationLetter || undefined,
      })
      setPositions((previous) =>
        previous.map((position) =>
          position.id === positionId
            ? {
                ...position,
                applications: [...position.applications, positionApplication],
              }
            : position,
        ),
      )
    } catch (requestError) {
      setApplyError(requestError instanceof Error ? requestError.message : 'تعذر التقديم على الفرصة.')
    } finally {
      setApplyingId(null)
    }
  }

  const handleCancel = async (positionId: string, applicationId: string) => {
    setApplyError(null)
    setCancellingId(positionId)

    try {
      await selfCancelPositionApplication(applicationId)
      setPositions((previous) =>
        previous.map((position) =>
          position.id === positionId
            ? {
                ...position,
                applications: position.applications.filter((application) => application.id !== applicationId),
              }
            : position,
        ),
      )
    } catch (requestError) {
      setApplyError(requestError instanceof Error ? requestError.message : 'تعذر إلغاء طلب التطوع.')
    } finally {
      setCancellingId(null)
    }
  }

  const renderPosition = (position: VmsPosition, showApply: boolean) => {
    const myApplication = user?.membershipNumber
      ? position.applications.find(
          (application) => application.membershipNumber === user.membershipNumber,
        )
      : undefined
    const seatsFilled = position.acceptedApplicationsCount
    const seatsTotal = position.seats

    return (
      <View key={position.id} style={styles.positionCard}>
        <Text style={styles.positionProject}>{position.projectName || 'مشروع'}</Text>
        <Text style={styles.positionName}>{position.name}</Text>
        {position.description ? (
          <Text style={styles.positionDescription} numberOfLines={3}>
            {position.description}
          </Text>
        ) : null}
        <Text style={styles.positionMeta}>
          المقاعد: {seatsFilled}/{seatsTotal} · بواسطة {position.createdByDisplayName}
        </Text>

        {myApplication ? (
          <StatusPill
            label={applicationStatusLabel(myApplication.status)}
            tone={applicationTone(myApplication.status)}
          />
        ) : null}

        {myApplication?.status === 'pending' ? (
          <Pressable
            style={[styles.cancelButton, cancellingId === position.id && styles.applyDisabled]}
            disabled={cancellingId === position.id}
            onPress={() => void handleCancel(position.id, myApplication.id)}
          >
            <Text style={styles.cancelText}>
              {cancellingId === position.id ? 'جارٍ الإلغاء...' : 'إلغاء الطلب'}
            </Text>
          </Pressable>
        ) : null}

        {showApply ? (
          <>
            <TextInput
              value={motivationDraft[position.id] ?? ''}
              onChangeText={(value) =>
                setMotivationDraft((previous) => ({ ...previous, [position.id]: value }))
              }
              placeholder="رسالة تحفيزية (اختياري)"
              placeholderTextColor={colors.textMuted}
              style={styles.motivationInput}
              textAlign="right"
              multiline
            />
            <Pressable
            style={[styles.applyButton, applyingId === position.id && styles.applyDisabled]}
            disabled={applyingId === position.id}
            onPress={() => void handleApply(position.id)}
          >
            <Text style={styles.applyText}>
              {applyingId === position.id ? 'جارٍ التقديم...' : 'قدّم الآن'}
            </Text>
            </Pressable>
          </>
        ) : null}
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void load(true)} />}
    >
      {isLoading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} /> : null}
      {error ? <ErrorBanner message={error} /> : null}

      {!isLoading && !error ? (
        <>
          <View style={styles.quickLinks}>
            <Pressable style={styles.quickLink} onPress={() => router.push('/community/clubs')}>
              <Text style={styles.quickLinkText}>تصفّح الأندية</Text>
            </Pressable>
          </View>

          <SectionTitle
            title="لوحة المتصدرين"
            subtitle="أفضل الأعضاء حسب النقاط المكتسبة من المهام والأنشطة."
          />

          <View style={styles.rankRow}>
            <StatusPill label="أفضل 3 أعضاء" tone="warning" />
            {viewerRank ? <StatusPill label={`ترتيبك: ${viewerRank}`} tone="success" /> : null}
            {viewer ? <StatusPill label={`نقاطك: ${viewer.points}`} tone="info" /> : null}
          </View>

          {topThree.length === 0 ? (
            <EmptyState message="لا توجد بيانات لوحة متصدرين بعد." />
          ) : (
            <View style={styles.podium}>
              {topThree.map((entry, index) => (
                <View
                  key={`${entry.name}-${index}`}
                  style={[styles.podiumCard, entry.isViewer && styles.podiumViewer]}
                >
                  <Text style={styles.podiumRank}>#{index + 1}</Text>
                  <Text style={styles.podiumName} numberOfLines={1}>
                    {entry.name}
                  </Text>
                  <Text style={styles.podiumPoints}>{entry.points.toLocaleString('en-US')} نقطة</Text>
                </View>
              ))}
            </View>
          )}

          {restEntries.length > 0 ? (
            <View style={styles.block}>
              <Text style={styles.blockTitle}>بقية المتصدرين</Text>
              {restEntries.map((entry, index) => (
                <View
                  key={`${entry.name}-${index + 3}`}
                  style={[styles.podiumCard, entry.isViewer && styles.podiumViewer]}
                >
                  <Text style={styles.podiumRank}>#{index + 4}</Text>
                  <Text style={styles.podiumName} numberOfLines={1}>
                    {entry.name}
                  </Text>
                  <Text style={styles.podiumPoints}>{entry.points.toLocaleString('en-US')} نقطة</Text>
                </View>
              ))}
            </View>
          ) : null}

          <SectionTitle
            title="التطوع"
            subtitle="الفرص التطوعية المفتوحة عبر المشاريع. تصفّح وقدّم مباشرة."
          />

          <View style={styles.rankRow}>
            <StatusPill label={`${positions.length} فرصة مفتوحة`} tone="success" />
            {applied.length > 0 ? (
              <StatusPill label={`${applied.length} طلب مقدّم`} tone="neutral" />
            ) : null}
          </View>

          {applyError ? <ErrorBanner message={applyError} /> : null}

          <SearchField
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="ابحث في فرص التطوع..."
          />

          {applied.length > 0 ? (
            <View style={styles.block}>
              <Text style={styles.blockTitle}>طلباتك</Text>
              {applied.map((position) => renderPosition(position, false))}
            </View>
          ) : null}

          <View style={styles.block}>
            <Text style={styles.blockTitle}>فرص متاحة</Text>
            {filteredAvailable.length === 0 ? (
              <EmptyState message="لا توجد فرص متاحة للتقديم حالياً." />
            ) : (
              filteredAvailable.map((position) => renderPosition(position, true))
            )}
          </View>
        </>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: 16, gap: 12, paddingBottom: 40 },
  rankRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickLinks: {
    flexDirection: 'row-reverse',
  },
  quickLink: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  quickLinkText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  podium: { gap: 8 },
  podiumCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  podiumViewer: {
    borderColor: '#fcd34d',
    backgroundColor: '#fffbeb',
  },
  podiumRank: {
    color: colors.accent,
    fontWeight: '800',
    fontSize: 16,
  },
  podiumName: {
    flex: 1,
    color: colors.text,
    fontWeight: '700',
    textAlign: 'right',
  },
  podiumPoints: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  block: { gap: 10, marginTop: 4 },
  blockTitle: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 15,
    textAlign: 'right',
  },
  positionCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
  },
  positionProject: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  positionName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'right',
  },
  positionDescription: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'right',
  },
  positionMeta: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'right',
  },
  applyButton: {
    marginTop: 4,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelButton: {
    marginTop: 4,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    alignItems: 'center',
  },
  applyDisabled: { opacity: 0.7 },
  applyText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  cancelText: {
    color: colors.danger,
    fontWeight: '700',
    fontSize: 14,
  },
  motivationInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    backgroundColor: '#f8fafc',
    minHeight: 72,
    textAlignVertical: 'top',
    fontSize: 14,
  },
})
