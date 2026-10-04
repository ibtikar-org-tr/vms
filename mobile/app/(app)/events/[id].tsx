import { Stack, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import {
  changeEventRegistrationTicket,
  createEventRegistration,
  fetchEventById,
  fetchEventTickets,
  fetchMyEventRegistration,
  selfCancelEventRegistration,
} from '@/src/api/events'
import { useAuth } from '@/src/auth/AuthContext'
import { ErrorBanner, StatusPill } from '@/src/components/ui'
import { colors } from '@/src/theme/colors'
import type { VmsEvent, VmsEventRegistration, VmsEventTicket } from '@/src/types/events'
import {
  formatEventDate,
  formatEventLocation,
  isEventUpcomingOrOngoing,
  eventDescriptionPlainText,
} from '@/src/utils/format'
import {
  canSelfModifyRegistration,
  registrationStatusLabel,
  selfCancellationHelperText,
} from '@/src/utils/labels'

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuth()
  const [event, setEvent] = useState<VmsEvent | null>(null)
  const [tickets, setTickets] = useState<VmsEventTicket[]>([])
  const [registrations, setRegistrations] = useState<VmsEventRegistration[]>([])
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isApplying, setIsApplying] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id || !user?.membershipNumber) {
      setError('معرّف الفعالية غير صالح.')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const [eventPayload, ticketsPayload, registrationPayload] = await Promise.all([
        fetchEventById(id),
        fetchEventTickets(id),
        fetchMyEventRegistration(id, user.membershipNumber),
      ])
      setEvent(eventPayload.event)
      setTickets(ticketsPayload.eventTickets)
      setRegistrations(
        registrationPayload.eventRegistrations.filter(
          (item) => item.status === 'registered' || item.status === 'attended',
        ),
      )
      setSelectedTicketIds([])
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذر تحميل الفعالية.')
    } finally {
      setIsLoading(false)
    }
  }, [id, user?.membershipNumber])

  useEffect(() => {
    void load()
  }, [load])

  const links = useMemo(() => {
    if (!event?.associatedUrls || typeof event.associatedUrls !== 'object') {
      return [] as Array<{ label: string; url: string }>
    }

    return Object.entries(event.associatedUrls)
      .map(([label, value]) => ({
        label,
        url: typeof value === 'string' ? value : String(value ?? ''),
      }))
      .filter((item) => item.url.startsWith('http'))
  }, [event])

  const skillNames = event?.skills ? Object.keys(event.skills) : []
  const upcoming = event ? isEventUpcomingOrOngoing(event) : false
  const ownedTicketIds = useMemo(
    () => new Set(registrations.map((item) => item.ticketId)),
    [registrations],
  )
  const remainingTickets = useMemo(
    () => tickets.filter((ticket) => !ownedTicketIds.has(ticket.id)),
    [ownedTicketIds, tickets],
  )
  const remainingAvailableTickets = remainingTickets.filter(
    (ticket) => (ticket.activeRegistrationCount ?? 0) < ticket.quantity,
  )
  const newSelectedTicketIds = selectedTicketIds.filter((ticketId) =>
    remainingAvailableTickets.some((ticket) => ticket.id === ticketId),
  )
  const hasSelectedTickets = newSelectedTicketIds.length > 0

  const toggleTicketSelection = (ticketId: string) => {
    setSelectedTicketIds((current) =>
      current.includes(ticketId) ? current.filter((id) => id !== ticketId) : [...current, ticketId],
    )
  }

  const handleRegister = async () => {
    if (!event || !user?.membershipNumber || !hasSelectedTickets) return

    setIsApplying(true)
    setActionError(null)
    setActionSuccess(null)

    try {
      const payload = await createEventRegistration({
        eventId: event.id,
        ticketIds: newSelectedTicketIds,
        membershipNumber: user.membershipNumber,
        status: 'registered',
      })
      const created = payload.eventRegistrations?.length ? payload.eventRegistrations : [payload.eventRegistration]
      setRegistrations((current) => [...created, ...current])
      setSelectedTicketIds([])
      const customMessage = eventDescriptionPlainText(event.registrationSuccessMessage)
      setActionSuccess(
        customMessage ||
          (created.length > 1 ? 'تم تسجيل التذاكر المختارة بنجاح.' : 'تم التسجيل في الفعالية بنجاح.'),
      )
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'تعذر التسجيل.')
    } finally {
      setIsApplying(false)
    }
  }

  const handleCancel = async (registration: VmsEventRegistration) => {
    if (!event || !canSelfModifyRegistration(event, registration, user?.membershipNumber)) return

    setIsCancelling(true)
    setActionError(null)
    setActionSuccess(null)

    try {
      await selfCancelEventRegistration(registration.id)
      setRegistrations((current) => current.filter((item) => item.id !== registration.id))
      setActionSuccess('تم إلغاء التذكرة.')
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'تعذر الإلغاء.')
    } finally {
      setIsCancelling(false)
    }
  }

  const handleChangeTicket = async (registration: VmsEventRegistration, ticketId: string) => {
    if (!event || !canSelfModifyRegistration(event, registration, user?.membershipNumber)) return

    setIsApplying(true)
    setActionError(null)
    setActionSuccess(null)

    try {
      const payload = await changeEventRegistrationTicket(registration.id, ticketId)
      setRegistrations((current) =>
        current.map((item) => (item.id === payload.eventRegistration.id ? payload.eventRegistration : item)),
      )
      setActionSuccess('تم تغيير التذكرة.')
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'تعذر تغيير التذكرة.')
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: event?.name ?? 'تفاصيل الفعالية' }} />
      <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
        {isLoading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : null}
        {error ? <ErrorBanner message={error} /> : null}

        {event ? (
          <View style={styles.card}>
            {event.imageUrl ? (
              <Image source={{ uri: event.imageUrl }} style={styles.banner} resizeMode="cover" />
            ) : null}

            <View style={styles.headerRow}>
              <StatusPill label={upcoming ? 'قادمة / جارية' : 'منتهية'} tone={upcoming ? 'success' : 'neutral'} />
              <StatusPill
                label={event.status === 'public' ? 'عامة' : event.status === 'draft' ? 'مسودة' : event.status}
                tone={event.status === 'public' ? 'info' : 'warning'}
              />
            </View>

            <Text style={styles.title}>{event.name}</Text>

            <View style={styles.row}>
              <Text style={styles.label}>البداية</Text>
              <Text style={styles.value}>{formatEventDate(event.startTime)}</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>النهاية</Text>
              <Text style={styles.value}>{formatEventDate(event.endTime)}</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>الموقع</Text>
              <Text style={styles.value}>{formatEventLocation(event)}</Text>
            </View>

            {event.address ? (
              <View style={styles.row}>
                <Text style={styles.label}>العنوان</Text>
                <Text style={styles.value}>{event.address}</Text>
              </View>
            ) : null}

            {event.projectName ? (
              <View style={styles.row}>
                <Text style={styles.label}>المشروع</Text>
                <Text style={styles.value}>{event.projectName}</Text>
              </View>
            ) : null}

            {skillNames.length > 0 ? (
              <View style={styles.row}>
                <Text style={styles.label}>المهارات</Text>
                <Text style={styles.value}>{skillNames.join('، ')}</Text>
              </View>
            ) : null}

            {event.description ? (
              <View style={styles.descriptionBlock}>
                <Text style={styles.label}>الوصف</Text>
                <Text style={styles.description}>{eventDescriptionPlainText(event.description) || event.description}</Text>
              </View>
            ) : null}

            {links.length > 0 ? (
              <View style={styles.linksBlock}>
                <Text style={styles.label}>روابط مرتبطة</Text>
                {links.map((link) => (
                  <Pressable key={`${link.label}-${link.url}`} onPress={() => void Linking.openURL(link.url)}>
                    <Text style={styles.link}>{link.label || link.url}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {upcoming && event.status === 'public' ? (
              <View style={styles.registrationBlock}>
                <Text style={styles.sectionTitle}>التسجيل</Text>
                <Text style={styles.helperText}>{selfCancellationHelperText(event)}</Text>

                {actionError ? <ErrorBanner message={actionError} /> : null}
                {actionSuccess ? <Text style={styles.successText}>{actionSuccess}</Text> : null}

                {registrations.length > 0 ? (
                  <View style={styles.registrationCard}>
                    {registrations.map((item) => {
                      const registeredTicket = tickets.find((ticket) => ticket.id === item.ticketId) ?? null
                      const canModifyThis = event
                        ? canSelfModifyRegistration(event, item, user?.membershipNumber)
                        : false

                      return (
                        <View key={item.id} style={styles.ownedTicketCard}>
                          <StatusPill
                            label={registrationStatusLabel(item.status)}
                            tone={item.status === 'registered' ? 'success' : 'neutral'}
                          />
                          {registeredTicket ? (
                            <Text style={styles.value}>التذكرة: {registeredTicket.name}</Text>
                          ) : null}

                          {canModifyThis && remainingTickets.length > 0 ? (
                            <View style={styles.ticketList}>
                              <Text style={styles.label}>تغيير هذه التذكرة</Text>
                              {remainingTickets.map((ticket) => {
                                const soldOut = (ticket.activeRegistrationCount ?? 0) >= ticket.quantity
                                return (
                                  <Pressable
                                    key={ticket.id}
                                    style={[styles.ticketOption, soldOut && styles.disabled]}
                                    disabled={isApplying || soldOut}
                                    onPress={() => void handleChangeTicket(item, ticket.id)}
                                  >
                                    <Text style={styles.ticketName}>{ticket.name}</Text>
                                    <Text style={styles.ticketMeta}>
                                      {ticket.pointPrice} نقطة
                                      {ticket.currencyPrice ? ` · ${ticket.currencyPrice}` : ''}
                                      {soldOut ? ' · نفدت' : ''}
                                    </Text>
                                  </Pressable>
                                )
                              })}
                            </View>
                          ) : null}

                          {canModifyThis ? (
                            <Pressable
                              style={[styles.cancelButton, isCancelling && styles.disabled]}
                              disabled={isCancelling}
                              onPress={() => void handleCancel(item)}
                            >
                              <Text style={styles.cancelText}>
                                {isCancelling ? 'جارٍ الإلغاء...' : 'إلغاء هذه التذكرة'}
                              </Text>
                            </Pressable>
                          ) : null}
                        </View>
                      )
                    })}
                  </View>
                ) : null}

                {remainingTickets.length > 0 ? (
                  <View style={styles.ticketList}>
                    <Text style={styles.label}>
                      {registrations.length > 0 ? 'أضف تذاكر أخرى' : 'اختر تذكرة واحدة أو أكثر'}
                    </Text>
                    {remainingTickets.map((ticket) => {
                      const selected = selectedTicketIds.includes(ticket.id)
                      const soldOut = (ticket.activeRegistrationCount ?? 0) >= ticket.quantity
                      return (
                        <Pressable
                          key={ticket.id}
                          style={[
                            styles.ticketOption,
                            selected && styles.ticketSelected,
                            soldOut && styles.disabled,
                          ]}
                          disabled={soldOut}
                          onPress={() => toggleTicketSelection(ticket.id)}
                        >
                          <Text style={styles.ticketName}>{ticket.name}</Text>
                          <Text style={styles.ticketMeta}>
                            {ticket.pointPrice} نقطة
                            {ticket.currencyPrice ? ` · ${ticket.currencyPrice}` : ''}
                            {soldOut ? ' · نفدت' : selected ? ' · مختارة' : ''}
                          </Text>
                          {ticket.description ? (
                            <Text style={styles.ticketDescription}>{ticket.description}</Text>
                          ) : null}
                        </Pressable>
                      )
                    })}

                    <Pressable
                      style={[styles.registerButton, (isApplying || !hasSelectedTickets) && styles.disabled]}
                      disabled={isApplying || !hasSelectedTickets}
                      onPress={() => void handleRegister()}
                    >
                      <Text style={styles.registerText}>
                        {isApplying
                          ? 'جارٍ التسجيل...'
                          : registrations.length > 0
                            ? hasSelectedTickets && newSelectedTicketIds.length > 1
                              ? `إضافة التذاكر (${newSelectedTicketIds.length})`
                              : 'إضافة التذكرة المختارة'
                            : hasSelectedTickets && newSelectedTicketIds.length > 1
                              ? `سجّل الآن (${newSelectedTicketIds.length})`
                              : 'سجّل الآن'}
                      </Text>
                    </Pressable>
                  </View>
                ) : registrations.length === 0 ? (
                  <Text style={styles.helperText}>لا تتوفر تذاكر لهذه الفعالية حالياً.</Text>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
    overflow: 'hidden',
  },
  banner: {
    width: '100%',
    height: 180,
    borderRadius: 14,
    backgroundColor: '#e2e8f0',
  },
  headerRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'right',
  },
  row: { gap: 4 },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
  },
  value: {
    color: colors.text,
    fontSize: 15,
    textAlign: 'right',
    lineHeight: 22,
  },
  descriptionBlock: { marginTop: 4, gap: 6 },
  description: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'right',
  },
  linksBlock: { gap: 8 },
  link: {
    color: colors.primary,
    fontWeight: '700',
    textAlign: 'right',
    fontSize: 14,
  },
  registrationBlock: {
    marginTop: 8,
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 16,
    textAlign: 'right',
  },
  helperText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'right',
  },
  successText: {
    color: '#047857',
    fontWeight: '700',
    textAlign: 'right',
  },
  registrationCard: {
    gap: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
  },
  ownedTicketCard: {
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ticketList: { gap: 8 },
  ticketOption: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 4,
    backgroundColor: '#fff',
  },
  ticketSelected: {
    borderColor: colors.primary,
    backgroundColor: '#ecfeff',
  },
  ticketName: {
    color: colors.text,
    fontWeight: '800',
    textAlign: 'right',
    fontSize: 14,
  },
  ticketMeta: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'right',
  },
  ticketDescription: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'right',
    lineHeight: 18,
  },
  registerButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  registerText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelText: {
    color: colors.danger,
    fontWeight: '700',
    fontSize: 14,
  },
  disabled: { opacity: 0.7 },
})
