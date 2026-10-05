import UIKit
import Capacitor

final class MarathonerBridgeViewController: CAPBridgeViewController {
    private var startupOverlayViewController: UIViewController?
    private var startupTimeout: DispatchWorkItem?

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(StartupOverlayPlugin())
    }

    override func viewDidLoad() {
        installStartupOverlay()
        super.viewDidLoad()
    }

    private func installStartupOverlay() {
        guard
            startupOverlayViewController == nil,
            let overlay = UIStoryboard(name: "LaunchScreen", bundle: nil)
                .instantiateInitialViewController()
        else {
            return
        }

        addChild(overlay)
        overlay.view.frame = view.bounds
        overlay.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(overlay.view)
        overlay.didMove(toParent: self)
        startupOverlayViewController = overlay

        let timeout = DispatchWorkItem { [weak self] in
            self?.hideStartupOverlay()
        }
        startupTimeout = timeout
        DispatchQueue.main.asyncAfter(deadline: .now() + 10, execute: timeout)
    }

    func hideStartupOverlay() {
        startupTimeout?.cancel()
        startupTimeout = nil

        guard let overlay = startupOverlayViewController else {
            return
        }

        overlay.willMove(toParent: nil)
        overlay.view.removeFromSuperview()
        overlay.removeFromParent()
        startupOverlayViewController = nil
    }
}

@objc(StartupOverlayPlugin)
final class StartupOverlayPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "StartupOverlayPlugin"
    let jsName = "StartupOverlay"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "hide", returnType: CAPPluginReturnPromise)
    ]

    @objc func hide(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            (self?.bridge?.viewController as? MarathonerBridgeViewController)?
                .hideStartupOverlay()
            call.resolve()
        }
    }
}
