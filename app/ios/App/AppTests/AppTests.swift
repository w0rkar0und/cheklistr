import XCTest
@testable import App

final class AppTests: XCTestCase {

    // MARK: – App Delegate

    /// Verify the AppDelegate creates a window (Capacitor requirement).
    func testAppDelegateExists() {
        let delegate = UIApplication.shared.delegate
        XCTAssertNotNil(delegate, "UIApplication should have an AppDelegate")
        XCTAssertTrue(delegate is AppDelegate, "Delegate should be AppDelegate")
    }

    // MARK: – Info.plist Permissions

    /// Every iOS permission key required by the app must be present in Info.plist.
    /// If any are missing, the App Store review will reject the build and the
    /// native permission dialogs will crash instead of showing a prompt.
    func testRequiredInfoPlistKeysExist() {
        let requiredKeys = [
            "NSCameraUsageDescription",
            "NSPhotoLibraryUsageDescription",
            "NSPhotoLibraryAddUsageDescription",
            "NSLocationWhenInUseUsageDescription",
            "NSFaceIDUsageDescription",
        ]

        let info = Bundle.main.infoDictionary ?? [:]

        for key in requiredKeys {
            let value = info[key] as? String
            XCTAssertNotNil(value, "Info.plist must contain \(key)")
            XCTAssertFalse(
                value?.isEmpty ?? true,
                "\(key) must have a non-empty description string"
            )
        }
    }

    /// Permission strings must not contain literal quote marks — those were
    /// a bug caused by escaped XML entities in earlier builds.
    func testPermissionStringsHaveNoQuotes() {
        let permissionKeys = [
            "NSCameraUsageDescription",
            "NSPhotoLibraryUsageDescription",
            "NSPhotoLibraryAddUsageDescription",
            "NSLocationWhenInUseUsageDescription",
            "NSFaceIDUsageDescription",
        ]

        let info = Bundle.main.infoDictionary ?? [:]

        for key in permissionKeys {
            if let value = info[key] as? String {
                XCTAssertFalse(
                    value.contains("\""),
                    "\(key) should not contain literal quote marks: \(value)"
                )
            }
        }
    }

    // MARK: – Bundle Identity

    /// Verify the bundle identifier matches the expected production value.
    func testBundleIdentifier() {
        let bundleId = Bundle.main.bundleIdentifier
        XCTAssertEqual(bundleId, "com.cheklistr.app", "Bundle ID should be com.cheklistr.app")
    }

    /// The display name shown under the app icon on the home screen.
    func testBundleDisplayName() {
        let displayName = Bundle.main.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String
        XCTAssertEqual(displayName, "Cheklistr", "Display name should be Cheklistr")
    }

    // MARK: – Capacitor Config

    /// The Capacitor config JSON must exist as a bundle resource so the
    /// WebView knows where to find the built web assets.
    func testCapacitorConfigExists() {
        let configPath = Bundle.main.path(forResource: "capacitor.config", ofType: "json")
        XCTAssertNotNil(configPath, "capacitor.config.json must be bundled")

        if let path = configPath {
            let data = FileManager.default.contents(atPath: path)
            XCTAssertNotNil(data, "capacitor.config.json must be readable")
            XCTAssertTrue((data?.count ?? 0) > 0, "capacitor.config.json must not be empty")
        }
    }

    /// The built web assets (public/index.html) must be present.
    func testWebAssetsBundled() {
        let publicDir = Bundle.main.resourcePath.map { $0 + "/public" }
        XCTAssertNotNil(publicDir, "public directory must exist in bundle")

        if let dir = publicDir {
            let indexPath = dir + "/index.html"
            XCTAssertTrue(
                FileManager.default.fileExists(atPath: indexPath),
                "public/index.html must exist — run 'npm run build && npx cap sync' first"
            )
        }
    }
}
