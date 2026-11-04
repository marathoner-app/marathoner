import Capacitor
import CryptoKit
import Foundation
import HealthKit

@objc(HealthKitPlugin)
final class HealthKitPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "HealthKitPlugin"
    let jsName = "MarathonerHealthKit"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "synchronize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startMonitoring", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disconnect", returnType: CAPPluginReturnPromise),
    ]

    private let healthStore = HKHealthStore()
    private let workoutType = HKObjectType.workoutType()
    private var observerQuery: HKObserverQuery?
    private var observerScope: String?

    private static let defaultLookbackDays = 30
    private static let maximumLookbackDays = 90

    @objc func getStatus(_ call: CAPPluginCall) {
        guard let scope = accountScope(call) else { return }
        let available = HKHealthStore.isHealthDataAvailable()
        guard available else {
            call.resolve([
                "available": false,
                "enabled": false,
                "monitoring": false,
                "authorizationRequestStatus": "unavailable",
            ])
            return
        }

        healthStore.getRequestStatusForAuthorization(
            toShare: [],
            read: [workoutType]
        ) { [weak self] status, error in
            guard let self else { return }
            if let error {
                call.reject(
                    "Marathoner could not check Apple Health availability.",
                    "healthkit_status_failed",
                    error
                )
                return
            }
            call.resolve([
                "available": true,
                "enabled": self.isEnabled(for: scope),
                "monitoring": self.observerQuery != nil && self.observerScope == scope,
                "authorizationRequestStatus": self.authorizationRequestStatusValue(status),
            ])
        }
    }

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        guard let scope = accountScope(call) else { return }
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject(
                "Apple Health workout access is not available on this device.",
                "healthkit_unavailable"
            )
            return
        }

        let lookbackDays = boundedLookbackDays(call)
        healthStore.requestAuthorization(toShare: [], read: [workoutType]) {
            [weak self] success, error in
            guard let self else { return }
            if let error {
                call.reject(
                    "Marathoner could not finish the Apple Health permission request.",
                    "healthkit_authorization_failed",
                    error
                )
                return
            }
            guard success else {
                call.reject(
                    "Apple Health did not finish the workout permission request.",
                    "healthkit_authorization_incomplete"
                )
                return
            }

            self.setEnabled(true, for: scope)
            self.installObserver(for: scope, lookbackDays: lookbackDays)
            self.synchronize(
                scope: scope,
                lookbackDays: lookbackDays,
                completion: { result in call.resolve(result) },
                failure: { message, code, syncError in
                    call.reject(message, code, syncError)
                }
            )
        }
    }

    @objc func synchronize(_ call: CAPPluginCall) {
        guard let scope = accountScope(call) else { return }
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject(
                "Apple Health workout access is not available on this device.",
                "healthkit_unavailable"
            )
            return
        }
        guard isEnabled(for: scope) else {
            call.reject(
                "Connect Apple Health before synchronizing workouts.",
                "healthkit_not_enabled"
            )
            return
        }

        synchronize(
            scope: scope,
            lookbackDays: boundedLookbackDays(call),
            completion: { result in call.resolve(result) },
            failure: { message, code, error in call.reject(message, code, error) }
        )
    }

    @objc func startMonitoring(_ call: CAPPluginCall) {
        guard let scope = accountScope(call) else { return }
        guard HKHealthStore.isHealthDataAvailable(), isEnabled(for: scope) else {
            call.resolve([
                "available": HKHealthStore.isHealthDataAvailable(),
                "enabled": false,
                "monitoring": false,
            ])
            return
        }

        installObserver(for: scope, lookbackDays: boundedLookbackDays(call))
        call.resolve([
            "available": true,
            "enabled": true,
            "monitoring": true,
        ])
    }

    @objc func disconnect(_ call: CAPPluginCall) {
        guard let scope = accountScope(call) else { return }
        if let observerQuery {
            healthStore.stop(observerQuery)
            self.observerQuery = nil
            observerScope = nil
        }
        healthStore.disableBackgroundDelivery(for: workoutType) { [weak self] _, _ in
            guard let self else { return }
            self.setEnabled(false, for: scope)
            UserDefaults.standard.removeObject(forKey: self.anchorKey(for: scope))
            UserDefaults.standard.removeObject(forKey: self.queryStartDateKey(for: scope))
            UserDefaults.standard.removeObject(forKey: self.runningIdsKey(for: scope))
            call.resolve([
                "available": HKHealthStore.isHealthDataAvailable(),
                "enabled": false,
                "monitoring": false,
            ])
        }
    }

    private func accountScope(_ call: CAPPluginCall) -> String? {
        guard
            let scope = call.getString("accountScope")?.trimmingCharacters(in: .whitespacesAndNewlines),
            !scope.isEmpty,
            scope.count <= 256
        else {
            call.reject(
                "A signed-in account is required for Apple Health import.",
                "healthkit_account_required"
            )
            return nil
        }
        return scope
    }

    private func boundedLookbackDays(_ call: CAPPluginCall) -> Int {
        let requested = call.getInt("lookbackDays") ?? Self.defaultLookbackDays
        return min(max(requested, 1), Self.maximumLookbackDays)
    }

    private func installObserver(for scope: String, lookbackDays: Int) {
        if let observerQuery {
            healthStore.stop(observerQuery)
        }

        observerScope = scope
        let query = HKObserverQuery(sampleType: workoutType, predicate: nil) {
            [weak self] _, completionHandler, error in
            guard let self else {
                completionHandler()
                return
            }
            guard error == nil, self.isEnabled(for: scope) else {
                completionHandler()
                return
            }
            self.synchronize(
                scope: scope,
                lookbackDays: lookbackDays,
                completion: { result in
                    self.notifyListeners("workoutsChanged", data: result)
                    completionHandler()
                },
                failure: { message, code, _ in
                    self.notifyListeners("workoutsChanged", data: [
                        "error": message,
                        "code": code,
                    ])
                    completionHandler()
                }
            )
        }
        observerQuery = query
        healthStore.execute(query)
        healthStore.enableBackgroundDelivery(
            for: workoutType,
            frequency: .immediate
        ) { _, _ in }
    }

    private func synchronize(
        scope: String,
        lookbackDays: Int,
        completion: @escaping ([String: Any]) -> Void,
        failure: @escaping (String, String, Error?) -> Void
    ) {
        let startDate = queryStartDate(for: scope, lookbackDays: lookbackDays)
        let predicate = HKQuery.predicateForSamples(
            withStart: startDate,
            end: nil,
            options: .strictEndDate
        )
        let query = HKAnchoredObjectQuery(
            type: workoutType,
            predicate: predicate,
            anchor: loadAnchor(for: scope),
            limit: HKObjectQueryNoLimit
        ) { [weak self] _, samples, deletedObjects, newAnchor, error in
            guard let self else { return }
            if let error {
                failure(
                    "Marathoner could not read Apple Health workouts right now.",
                    "healthkit_query_failed",
                    error
                )
                return
            }

            let observedAt = self.iso8601(Date())
            var trackedRunningIds = self.runningIds(for: scope)
            var workouts: [[String: Any]] = []
            var skippedWorkoutCount = 0

            for sample in samples ?? [] {
                guard let workout = sample as? HKWorkout else { continue }
                guard workout.workoutActivityType == .running else {
                    skippedWorkoutCount += 1
                    continue
                }
                guard
                    let distance = workout.totalDistance?.doubleValue(for: .meter()),
                    distance.isFinite,
                    distance > 0,
                    workout.duration.isFinite,
                    workout.duration > 0
                else {
                    skippedWorkoutCount += 1
                    continue
                }

                let workoutId = workout.uuid.uuidString
                trackedRunningIds.insert(workoutId)
                workouts.append(self.workoutPayload(workout, observedAt: observedAt))
            }

            var deletedWorkoutIds: [String] = []
            for deletedObject in deletedObjects ?? [] {
                let workoutId = deletedObject.uuid.uuidString
                if trackedRunningIds.remove(workoutId) != nil {
                    deletedWorkoutIds.append(workoutId)
                }
            }

            self.saveRunningIds(trackedRunningIds, for: scope)
            if let newAnchor {
                self.saveAnchor(newAnchor, for: scope)
            }
            completion([
                "available": true,
                "enabled": true,
                "monitoring": self.observerQuery != nil && self.observerScope == scope,
                "observedAt": observedAt,
                "workouts": workouts,
                "deletedWorkoutIds": deletedWorkoutIds,
                "skippedWorkoutCount": skippedWorkoutCount,
            ])
        }
        healthStore.execute(query)
    }

    private func queryStartDate(for scope: String, lookbackDays: Int) -> Date {
        let key = queryStartDateKey(for: scope)
        if let storedDate = UserDefaults.standard.object(forKey: key) as? Date {
            return storedDate
        }

        let startDate = Calendar.current.date(
            byAdding: .day,
            value: -lookbackDays,
            to: Date()
        ) ?? Date(timeIntervalSinceNow: -2_592_000)
        UserDefaults.standard.set(startDate, forKey: key)
        return startDate
    }

    private func workoutPayload(
        _ workout: HKWorkout,
        observedAt: String
    ) -> [String: Any] {
        let metadataTimeZone = workout.metadata?[HKMetadataKeyTimeZone] as? String
        return [
            "providerActivityId": workout.uuid.uuidString,
            "startedAt": iso8601(workout.startDate),
            "endedAt": iso8601(workout.endDate),
            "durationSeconds": Int(workout.duration.rounded()),
            "distanceMeters": Int(
                (workout.totalDistance?.doubleValue(for: .meter()) ?? 0).rounded()
            ),
            "timeZone": metadataTimeZone ?? TimeZone.current.identifier,
            "sourceName": workout.sourceRevision.source.name,
            "sourceBundleIdentifier": workout.sourceRevision.source.bundleIdentifier,
            "observedAt": observedAt,
        ]
    }

    private func authorizationRequestStatusValue(
        _ status: HKAuthorizationRequestStatus
    ) -> String {
        switch status {
        case .shouldRequest:
            return "should_request"
        case .unnecessary:
            return "unnecessary"
        case .unknown:
            fallthrough
        @unknown default:
            return "unknown"
        }
    }

    private func storageScope(_ scope: String) -> String {
        SHA256.hash(data: Data(scope.utf8))
            .map { String(format: "%02x", $0) }
            .joined()
    }

    private func enabledKey(for scope: String) -> String {
        "marathoner.healthkit.enabled.\(storageScope(scope))"
    }

    private func anchorKey(for scope: String) -> String {
        "marathoner.healthkit.anchor.\(storageScope(scope))"
    }

    private func queryStartDateKey(for scope: String) -> String {
        "marathoner.healthkit.query-start-date.\(storageScope(scope))"
    }

    private func runningIdsKey(for scope: String) -> String {
        "marathoner.healthkit.running-ids.\(storageScope(scope))"
    }

    private func isEnabled(for scope: String) -> Bool {
        UserDefaults.standard.bool(forKey: enabledKey(for: scope))
    }

    private func setEnabled(_ enabled: Bool, for scope: String) {
        UserDefaults.standard.set(enabled, forKey: enabledKey(for: scope))
    }

    private func loadAnchor(for scope: String) -> HKQueryAnchor? {
        guard let data = UserDefaults.standard.data(forKey: anchorKey(for: scope)) else {
            return nil
        }
        return try? NSKeyedUnarchiver.unarchivedObject(
            ofClass: HKQueryAnchor.self,
            from: data
        )
    }

    private func saveAnchor(_ anchor: HKQueryAnchor, for scope: String) {
        guard
            let data = try? NSKeyedArchiver.archivedData(
                withRootObject: anchor,
                requiringSecureCoding: true
            )
        else { return }
        UserDefaults.standard.set(data, forKey: anchorKey(for: scope))
    }

    private func runningIds(for scope: String) -> Set<String> {
        Set(UserDefaults.standard.stringArray(forKey: runningIdsKey(for: scope)) ?? [])
    }

    private func saveRunningIds(_ ids: Set<String>, for scope: String) {
        UserDefaults.standard.set(ids.sorted(), forKey: runningIdsKey(for: scope))
    }

    private func iso8601(_ date: Date) -> String {
        ISO8601DateFormatter.marathoner.string(from: date)
    }
}

private extension ISO8601DateFormatter {
    static let marathoner: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}
