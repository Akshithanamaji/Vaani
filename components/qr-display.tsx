'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { generateQRImageUrl } from '@/lib/qr-utils';
import { speakText, stopSpeaking } from '@/lib/voice-utils';
import type { SubmittedService } from '@/lib/government-services';

// Status labels for display
const STATUS_LABELS: Record<string, { en: string; hi: string; te: string; color: string }> = {
  submitted: { en: 'Submitted', hi: 'जमा किया गया', te: 'సమర్పించబడింది', color: 'blue' },
  under_review: { en: 'Under Review', hi: 'समीक्षाधीन', te: 'సమీక్షలో ఉంది', color: 'yellow' },
  processing: { en: 'Processing', hi: 'प्रक्रिया में', te: 'ప్రాసెసింగ్', color: 'orange' },
  completed: { en: 'Completed', hi: 'पूर्ण', te: 'పూర్తయింది', color: 'green' },
  ready_for_collection: { en: 'Ready for Collection', hi: 'संग्रह के लिए तैयार', te: 'సేకరణకు సిద్ధంగా ఉంది', color: 'emerald' },
  collected: { en: 'Collected', hi: 'एकत्र किया गया', te: 'సేకరించబడింది', color: 'gray' },
  rejected: { en: 'Rejected', hi: 'अस्वीकृत', te: 'తిరస్కరించబడింది', color: 'red' },
};

interface QRDisplayProps {
  submission: SubmittedService;
  language: string;
  onNewApplication: () => void;
}

const QRDisplayComponent = ({ submission, language, onNewApplication }: QRDisplayProps) => {
  const [qrImageUrl, setQrImageUrl] = useState('');
  const [generatedQrUrl, setGeneratedQrUrl] = useState('');
  const [lanIp, setLanIp] = useState('');
  const status = submission.status || 'submitted';
  const statusInfo = STATUS_LABELS[status] || STATUS_LABELS.submitted;

  // Get status label based on language
  const getStatusLabel = () => {
    if (language === 'hi-IN') return statusInfo.hi;
    if (language === 'te-IN') return statusInfo.te;
    return statusInfo.en;
  };

  useEffect(() => {
    // Fetch the machine's LAN IP so phones on the same WiFi can reach the server.
    // Falls back to window.location.origin if the API call fails.
    const buildQrUrl = async () => {
      let origin = window.location.origin;

      try {
        const res = await fetch('/api/local-ip');
        if (res.ok) {
          const { ip } = await res.json();
          if (ip && ip !== '127.0.0.1') {
            // Replace hostname/localhost with actual LAN IP
            const port = window.location.port ? `:${window.location.port}` : '';
            origin = `http://${ip}${port}`;
            setLanIp(ip);
          }
        }
      } catch {
        // silent fallback to window.location.origin
      }

      // Embed a compact version of submission data as fallback
      // (keeps QR code simple enough to scan reliably)
      const minimalData = {
        id: submission.id,
        sn: submission.serviceName,
        n: submission.userDetails?.name || submission.userDetails?.fullName || '',
        p: submission.userDetails?.phone || submission.userDetails?.mobile || '',
        t: submission.submittedAt,
        st: submission.status || 'submitted',
      };
      const embeddedData = btoa(unescape(encodeURIComponent(JSON.stringify(minimalData))));

      const qrUrl = `${origin}/submission/${submission.id}?data=${encodeURIComponent(embeddedData)}`;
      const encodedUrl = encodeURIComponent(qrUrl);
      const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&ecc=M&data=${encodedUrl}`;
      setQrImageUrl(url);
      // Store generated URL for copy button
      setGeneratedQrUrl(qrUrl);
    };

    buildQrUrl();

    // Speak success message
    const messages: Record<string, string> = {
      'en-IN': `Application submitted successfully for ${submission.serviceName}. You will be notified when your document is ready for collection.`,
      'hi-IN': `${submission.serviceName} के लिए आवेदन सफलतापूर्वक जमा हो गया। जब आपका दस्तावेज़ संग्रह के लिए तैयार होगा तो आपको सूचित किया जाएगा।`,
      'te-IN': `${submission.serviceName} కోసం దరఖాస్తు విజయవంతంగా సమర్పించబడింది. మీ పత్రం సేకరణకు సిద్ధంగా ఉన్నప్పుడు మీకు తెలియజేయబడుతుంది.`,
      'kn-IN': `${submission.serviceName} ಗಾಗಿ ಅರ್ಜಿ ಯಶಸ್ವಿಯಾಗಿ ಸಲ್ಲಿಸಿದೆ. ನಿಮ್ಮ ದಾಖಲೆ ಸಂಗ್ರಹಣೆಗೆ ಸಿದ್ಧವಾದಾಗ ನಿಮಗೆ ತಿಳಿಸಲಾಗುವುದು.`,
    };

    const message = messages[language] || messages['en-IN'];
    const t = setTimeout(() => {
      speakText(message, language);
    }, 100);

    return () => {
      clearTimeout(t);
      stopSpeaking();
    };
  }, [submission, language]);

  const downloadQR = () => {
    const link = document.createElement('a');
    link.href = qrImageUrl;
    link.download = `qr-${submission.id}.png`;
    link.click();
  };

  const printQR = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>QR Code - ${submission.serviceName}</title>
            <style>
              body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
              .container { text-align: center; }
              img { max-width: 400px; margin: 20px 0; }
              .info { margin-top: 20px; text-align: left; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>${submission.serviceName}</h1>
              <img src="${qrImageUrl}" alt="QR Code" />
              <div class="info">
                <p><strong>Name:</strong> ${submission.userDetails.name}</p>
                <p><strong>Email:</strong> ${submission.userDetails.email}</p>
                <p><strong>Phone:</strong> ${submission.userDetails.phone}</p>
              </div>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 100);
    }
  };

  const copyQRData = () => {
    const url = generatedQrUrl || submission.qrUrl || `${window.location.origin}/submission/${submission.id}`;
    navigator.clipboard.writeText(url).then(() => {
      alert('Submission link copied! Open this link in any browser on the same WiFi to view your application details.');
    }).catch(() => {
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      alert('Submission link copied!');
    });
  };

  return (
    <div className="min-h-screen bg-black py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="space-y-8">
          {/* Success Header */}
          <Card className="shadow-2xl border-0 bg-white overflow-hidden">
            <div className="bg-gradient-to-r from-cyan-500 to-purple-600 p-8 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24"></div>

              <div className="relative z-10 text-center">
                <div className="inline-block p-4 bg-white/20 rounded-full mb-6">
                  <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-4xl font-bold mb-3">Application Submitted Successfully!</h2>
                <p className="text-purple-100/90 text-lg">Your application for {submission.serviceName} has been recorded and processed.</p>
                {/* Location Badge */}
                {submission.userDetails._state && submission.userDetails._district && (
                  <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur rounded-full">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-sm font-semibold text-white">
                      {submission.userDetails._district}, {submission.userDetails._state}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-8">
              {/* QR Code Display */}
              {qrImageUrl && (
                <div className="flex flex-col items-center mb-8 gap-3">
                  <div className="p-6 bg-white rounded-2xl shadow-lg border border-gray-100">
                    <Image
                      src={qrImageUrl || "/placeholder.svg"}
                      alt="QR Code"
                      width={280}
                      height={280}
                      priority
                      className="rounded-lg"
                    />
                  </div>
                  {lanIp ? (
                    <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-full">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs font-semibold text-green-700">
                        📱 Scan from your phone — points to <code className="font-mono">{lanIp}</code>
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-full">
                      <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span className="text-xs font-semibold text-yellow-700">
                        ⚠️ Make sure your phone is on the same WiFi network
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Application Status */}
              <div className={`border rounded-2xl p-6 mb-6 ${statusInfo.color === 'blue' ? 'bg-blue-50 border-blue-200' :
                statusInfo.color === 'yellow' ? 'bg-yellow-50 border-yellow-200' :
                  statusInfo.color === 'orange' ? 'bg-orange-50 border-orange-200' :
                    statusInfo.color === 'green' ? 'bg-green-50 border-green-200' :
                      statusInfo.color === 'emerald' ? 'bg-emerald-50 border-emerald-200' :
                        statusInfo.color === 'red' ? 'bg-red-50 border-red-200' :
                          'bg-gray-50 border-gray-200'
                }`}>
                <div className="flex items-center gap-3 mb-3">
                  <svg className={`w-5 h-5 ${statusInfo.color === 'blue' ? 'text-blue-600' :
                    statusInfo.color === 'yellow' ? 'text-yellow-600' :
                      statusInfo.color === 'orange' ? 'text-orange-600' :
                        statusInfo.color === 'green' ? 'text-green-600' :
                          statusInfo.color === 'emerald' ? 'text-emerald-600' :
                            statusInfo.color === 'red' ? 'text-red-600' :
                              'text-gray-600'
                    }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className={`font-bold ${statusInfo.color === 'blue' ? 'text-blue-800' :
                    statusInfo.color === 'yellow' ? 'text-yellow-800' :
                      statusInfo.color === 'orange' ? 'text-orange-800' :
                        statusInfo.color === 'green' ? 'text-green-800' :
                          statusInfo.color === 'emerald' ? 'text-emerald-800' :
                            statusInfo.color === 'red' ? 'text-red-800' :
                              'text-gray-800'
                    }`}>Application Status</h3>
                </div>
                <div className={`text-2xl font-bold mb-2 ${statusInfo.color === 'blue' ? 'text-blue-700' :
                  statusInfo.color === 'yellow' ? 'text-yellow-700' :
                    statusInfo.color === 'orange' ? 'text-orange-700' :
                      statusInfo.color === 'green' ? 'text-green-700' :
                        statusInfo.color === 'emerald' ? 'text-emerald-700' :
                          statusInfo.color === 'red' ? 'text-red-700' :
                            'text-gray-700'
                  }`}>
                  {getStatusLabel()}
                </div>
                <p className={`text-sm font-medium ${statusInfo.color === 'blue' ? 'text-blue-600' :
                  statusInfo.color === 'yellow' ? 'text-yellow-600' :
                    statusInfo.color === 'orange' ? 'text-orange-600' :
                      statusInfo.color === 'green' ? 'text-green-600' :
                        statusInfo.color === 'emerald' ? 'text-emerald-600' :
                          statusInfo.color === 'red' ? 'text-red-600' :
                            'text-gray-600'
                  }`}>
                  {status === 'ready_for_collection'
                    ? 'Please visit the office to collect your document'
                    : status === 'collected'
                      ? 'Document collected successfully'
                      : status === 'rejected'
                        ? 'Please contact the office for details'
                        : 'You will be notified when your document is ready'}
                </p>
              </div>
            </div>
          </Card>



          {/* Action Buttons */}
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm p-8">
            <h3 className="text-2xl font-bold mb-6 text-gray-900 flex items-center gap-3">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
              </svg>
              QR Code Actions
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                onClick={downloadQR}
                variant="outline"
                className="h-14 border-gray-200 hover:border-purple-300 hover:bg-purple-50 text-gray-700 hover:text-purple-700 font-semibold rounded-xl flex items-center gap-3"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download QR Code
              </Button>
              <Button
                onClick={printQR}
                variant="outline"
                className="h-14 border-gray-200 hover:border-purple-300 hover:bg-purple-50 text-gray-700 hover:text-purple-700 font-semibold rounded-xl flex items-center gap-3"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print QR Code
              </Button>
              <Button
                onClick={copyQRData}
                variant="outline"
                className="h-14 border-gray-200 hover:border-purple-300 hover:bg-purple-50 text-gray-700 hover:text-purple-700 font-semibold rounded-xl flex items-center gap-3 md:col-span-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy Submission Link
              </Button>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100">
              <Button
                onClick={onNewApplication}
                className="w-full h-14 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Start New Application
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export const QRDisplay = QRDisplayComponent;
export default QRDisplayComponent;
