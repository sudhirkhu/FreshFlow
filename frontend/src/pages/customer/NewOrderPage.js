import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Store, MapPin, Navigation, Star, ChevronRight, ChevronLeft, Search, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;
const GOOGLE_MAPS_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY || '';

function useGoogleMaps() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (window.google?.maps) {
      setLoaded(true);
      return;
    }
    if (!GOOGLE_MAPS_KEY) return;

    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
      existing.addEventListener('load', () => setLoaded(true));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places,geocoding`;
    script.async = true;
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, []);

  return loaded;
}

function MapView({ customerLocation, providers, selectedProvider, onSelectProvider }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const mapsLoaded = useGoogleMaps();

  useEffect(() => {
    if (!mapsLoaded || !mapRef.current || !customerLocation) return;

    if (!mapInstance.current) {
      mapInstance.current = new window.google.maps.Map(mapRef.current, {
        center: customerLocation,
        zoom: 13,
        styles: [
          { featureType: 'poi', stylers: [{ visibility: 'simplified' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] }
        ],
        mapTypeControl: false,
        streetViewControl: false,
      });
    } else {
      mapInstance.current.setCenter(customerLocation);
    }

    // Clear old markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    // Customer marker
    const customerMarker = new window.google.maps.Marker({
      position: customerLocation,
      map: mapInstance.current,
      title: 'Your Location',
      icon: {
        url: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="%230EA5E9" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="white"/></svg>'),
        scaledSize: new window.google.maps.Size(32, 32),
      },
      zIndex: 10,
    });
    markersRef.current.push(customerMarker);

    // Provider markers
    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend(customerLocation);

    providers.forEach((provider) => {
      if (!provider.location) return;
      const pos = { lat: provider.location.lat, lng: provider.location.lng };
      bounds.extend(pos);

      const isSelected = selectedProvider?.user_id === provider.user_id;
      const marker = new window.google.maps.Marker({
        position: pos,
        map: mapInstance.current,
        title: provider.business_name,
        icon: {
          url: 'data:image/svg+xml,' + encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="${isSelected ? '%2310B981' : '%23F97316'}" stroke="white" stroke-width="1.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="3" fill="white"/></svg>`
          ),
          scaledSize: new window.google.maps.Size(36, 36),
        },
        zIndex: isSelected ? 5 : 1,
      });

      const infoContent = `<div style="padding:8px;min-width:180px">
        <strong>${provider.business_name}</strong><br/>
        <span style="color:#666">${provider.distance_miles} mi away</span><br/>
        <span style="color:#0EA5E9;font-weight:600">$${provider.price_per_lb}/lb</span>
        <span style="margin-left:8px">⭐ ${provider.rating}</span>
      </div>`;
      const info = new window.google.maps.InfoWindow({ content: infoContent });

      marker.addListener('click', () => {
        onSelectProvider(provider);
        info.open(mapInstance.current, marker);
      });

      if (isSelected) {
        info.open(mapInstance.current, marker);
      }

      markersRef.current.push(marker);
    });

    if (providers.length > 0) {
      mapInstance.current.fitBounds(bounds, { padding: 60 });
    }
  }, [mapsLoaded, customerLocation, providers, selectedProvider, onSelectProvider]);

  if (!GOOGLE_MAPS_KEY) {
    return (
      <div className="w-full h-[350px] rounded-xl bg-gradient-to-br from-sky-50 to-blue-50 border border-slate-200 flex flex-col items-center justify-center">
        <MapPin className="w-12 h-12 text-sky-300 mb-3" />
        <p className="text-slate-500 text-sm font-medium">Map Preview</p>
        <p className="text-slate-400 text-xs mt-1">Add REACT_APP_GOOGLE_MAPS_KEY to enable Google Maps</p>
        {customerLocation && (
          <p className="text-sky-600 text-xs mt-2 font-mono">
            {customerLocation.lat.toFixed(4)}, {customerLocation.lng.toFixed(4)}
          </p>
        )}
        {providers.length > 0 && (
          <p className="text-emerald-600 text-xs mt-1">{providers.length} providers nearby</p>
        )}
      </div>
    );
  }

  return <div ref={mapRef} className="w-full h-[350px] rounded-xl border border-slate-200" />;
}

export default function NewOrderPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [providers, setProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [customerLocation, setCustomerLocation] = useState(null);
  const [geocoding, setGeocoding] = useState(false);
  const [formData, setFormData] = useState({
    provider_id: '',
    pickup_address: '',
    pickup_city: '',
    pickup_state: '',
    pickup_zipcode: '',
    pickup_time: '',
    notes: ''
  });
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [items, setItems] = useState([{
    service_type: 'Wash & Fold',
    weight: '',
    price: ''
  }]);

  const geocodeAddress = useCallback(async () => {
    const { pickup_address, pickup_city, pickup_state, pickup_zipcode } = formData;
    if (!pickup_address || !pickup_city || !pickup_state) {
      toast.error('Please fill in your address, city, and state');
      return;
    }

    setGeocoding(true);
    const fullAddress = `${pickup_address}, ${pickup_city}, ${pickup_state} ${pickup_zipcode}`;

    try {
      // Try Google Geocoding if available
      if (window.google?.maps?.Geocoder) {
        const geocoder = new window.google.maps.Geocoder();
        const result = await new Promise((resolve, reject) => {
          geocoder.geocode({ address: fullAddress }, (results, status) => {
            if (status === 'OK' && results[0]) {
              resolve({
                lat: results[0].geometry.location.lat(),
                lng: results[0].geometry.location.lng()
              });
            } else {
              reject(new Error('Geocoding failed'));
            }
          });
        });
        setCustomerLocation(result);
        await fetchNearbyProviders(result.lat, result.lng);
        setStep(2);
        return;
      }

      // Fallback: use a default Frisco location based on zip code
      const fallbackCoords = getFallbackCoords(pickup_zipcode, pickup_city);
      setCustomerLocation(fallbackCoords);
      await fetchNearbyProviders(fallbackCoords.lat, fallbackCoords.lng);
      setStep(2);
    } catch (error) {
      // Use fallback on any error
      const fallbackCoords = getFallbackCoords(formData.pickup_zipcode, formData.pickup_city);
      setCustomerLocation(fallbackCoords);
      await fetchNearbyProviders(fallbackCoords.lat, fallbackCoords.lng);
      setStep(2);
    } finally {
      setGeocoding(false);
    }
  }, [formData]);

  const getFallbackCoords = (zipcode, city) => {
    const zipMap = {
      '75034': { lat: 33.1507, lng: -96.8236 },
      '75035': { lat: 33.1750, lng: -96.8200 },
      '75033': { lat: 33.1300, lng: -96.8400 },
      '75036': { lat: 33.1600, lng: -96.7900 },
    };
    return zipMap[zipcode] || { lat: 33.1507, lng: -96.8236 };
  };

  const fetchNearbyProviders = async (lat, lng) => {
    setLoadingProviders(true);
    try {
      const response = await axios.get(`${API_URL}/providers/nearby?lat=${lat}&lng=${lng}&radius=20`);
      setProviders(response.data);
      if (response.data.length === 0) {
        toast.info('No providers found nearby. Showing all providers.');
        const allRes = await axios.get(`${API_URL}/providers`);
        setProviders(allRes.data);
      }
    } catch (error) {
      toast.error('Failed to load nearby providers');
      const allRes = await axios.get(`${API_URL}/providers`);
      setProviders(allRes.data);
    } finally {
      setLoadingProviders(false);
    }
  };

  const handleSelectProvider = useCallback((provider) => {
    setSelectedProvider(provider);
    setFormData(prev => ({ ...prev, provider_id: provider.user_id }));
    // Recalculate item prices
    setItems(prev => prev.map(item => ({
      ...item,
      price: item.weight ? (parseFloat(item.weight) * provider.price_per_lb).toFixed(2) : ''
    })));
  }, []);

  const addItem = () => {
    setItems([...items, { service_type: 'Wash & Fold', weight: '', price: '' }]);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;

    if (field === 'weight' && value && selectedProvider) {
      newItems[index].price = (parseFloat(value) * selectedProvider.price_per_lb).toFixed(2);
    }

    setItems(newItems);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.provider_id) {
      toast.error('Please select a provider');
      return;
    }

    if (items.some(item => !item.weight || !item.price)) {
      toast.error('Please fill in all item details');
      return;
    }

    if (!formData.pickup_time) {
      toast.error('Please select a pickup time');
      return;
    }

    setSubmitting(true);

    try {
      const orderData = {
        ...formData,
        items: items.map(item => ({
          service_type: item.service_type,
          weight: parseFloat(item.weight),
          price: parseFloat(item.price)
        }))
      };

      await axios.post(`${API_URL}/orders`, orderData);
      toast.success('Order created successfully!');
      navigate('/customer/orders');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);

  return (
    <DashboardLayout role="customer">
      <div data-testid="new-order-page" className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Create New Order
          </h1>
          <p className="text-slate-600 mt-2">
            {step === 1 && 'Enter your pickup address to find nearby providers'}
            {step === 2 && 'Select a laundry provider near you'}
            {step === 3 && 'Add your laundry items and schedule pickup'}
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2">
          {[
            { num: 1, label: 'Your Address' },
            { num: 2, label: 'Select Provider' },
            { num: 3, label: 'Order Details' }
          ].map((s, i) => (
            <React.Fragment key={s.num}>
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  step === s.num ? 'bg-sky-500 text-white' :
                  step > s.num ? 'bg-emerald-100 text-emerald-700' :
                  'bg-slate-100 text-slate-400'
                }`}
              >
                {step > s.num ? <CheckCircle className="w-4 h-4" /> : <span>{s.num}</span>}
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < 2 && <ChevronRight className="w-4 h-4 text-slate-300" />}
            </React.Fragment>
          ))}
        </div>

        {/* Step 1: Address Input */}
        {step === 1 && (
          <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-sky-500" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900">Where should we pick up?</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="address">Street Address</Label>
                <Input
                  data-testid="address-input"
                  id="address"
                  value={formData.pickup_address}
                  onChange={(e) => setFormData({ ...formData, pickup_address: e.target.value })}
                  required
                  className="mt-2 rounded-xl h-12 bg-slate-50"
                  placeholder="1234 Elm Street"
                />
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  data-testid="city-input"
                  id="city"
                  value={formData.pickup_city}
                  onChange={(e) => setFormData({ ...formData, pickup_city: e.target.value })}
                  required
                  className="mt-2 rounded-xl h-12 bg-slate-50"
                  placeholder="Frisco"
                />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input
                  data-testid="state-input"
                  id="state"
                  value={formData.pickup_state}
                  onChange={(e) => setFormData({ ...formData, pickup_state: e.target.value })}
                  required
                  className="mt-2 rounded-xl h-12 bg-slate-50"
                  placeholder="TX"
                />
              </div>
              <div>
                <Label htmlFor="zipcode">ZIP Code</Label>
                <Input
                  data-testid="zipcode-input"
                  id="zipcode"
                  value={formData.pickup_zipcode}
                  onChange={(e) => setFormData({ ...formData, pickup_zipcode: e.target.value })}
                  required
                  className="mt-2 rounded-xl h-12 bg-slate-50"
                  placeholder="75034"
                />
              </div>
            </div>

            <Button
              onClick={geocodeAddress}
              disabled={geocoding || !formData.pickup_address || !formData.pickup_city || !formData.pickup_state}
              className="w-full rounded-full h-12 bg-sky-500 hover:bg-sky-600 font-semibold"
            >
              {geocoding ? (
                <span className="flex items-center gap-2"><Search className="w-4 h-4 animate-spin" /> Finding nearby providers...</span>
              ) : (
                <span className="flex items-center gap-2"><Navigation className="w-4 h-4" /> Find Nearby Laundry Services</span>
              )}
            </Button>
          </div>
        )}

        {/* Step 2: Map + Provider Selection */}
        {step === 2 && (
          <div className="space-y-6">
            {/* Map */}
            <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
              <MapView
                customerLocation={customerLocation}
                providers={providers}
                selectedProvider={selectedProvider}
                onSelectProvider={handleSelectProvider}
              />
              <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-sky-500 inline-block" /> Your location
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-orange-500 inline-block" /> Laundry provider
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Selected
                </span>
              </div>
            </div>

            {/* Provider List */}
            <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">
                {loadingProviders ? 'Finding providers...' : `${providers.length} Providers Near You`}
              </h2>

              {loadingProviders ? (
                <div className="text-center py-8 text-slate-600 animate-pulse">Searching nearby providers...</div>
              ) : providers.length === 0 ? (
                <div className="text-center py-8">
                  <Store className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-600">No providers found in your area</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {providers.map((provider) => (
                    <div
                      key={provider.user_id}
                      data-testid={`provider-${provider.user_id}`}
                      onClick={() => handleSelectProvider(provider)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        selectedProvider?.user_id === provider.user_id
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-slate-200 hover:border-sky-300 hover:bg-sky-50/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-slate-900">{provider.business_name}</h3>
                            {selectedProvider?.user_id === provider.user_id && (
                              <CheckCircle className="w-5 h-5 text-emerald-500" />
                            )}
                          </div>
                          <p className="text-sm text-slate-600 mt-1">
                            {provider.address}, {provider.city}, {provider.state}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {provider.services.map(s => (
                              <span key={s} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">{s}</span>
                            ))}
                          </div>
                        </div>
                        <div className="text-right ml-4 flex-shrink-0">
                          {provider.distance_miles != null && (
                            <p className="text-lg font-bold text-sky-600">{provider.distance_miles} mi</p>
                          )}
                          <p className="text-sm font-semibold text-emerald-600">${provider.price_per_lb}/lb</p>
                          <div className="flex items-center gap-1 justify-end mt-1">
                            <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                            <span className="text-sm text-slate-600">{provider.rating}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)} className="rounded-full">
                <ChevronLeft className="w-4 h-4 mr-1" /> Change Address
              </Button>
              <Button
                onClick={() => {
                  if (!selectedProvider) {
                    toast.error('Please select a provider');
                    return;
                  }
                  setStep(3);
                }}
                className="rounded-full bg-sky-500 hover:bg-sky-600"
              >
                Continue <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Items & Submit */}
        {step === 3 && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Selected Provider Summary */}
            {selectedProvider && (
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200 flex items-center justify-between">
                <div>
                  <p className="text-sm text-emerald-600 font-medium">Selected Provider</p>
                  <p className="font-semibold text-slate-900">{selectedProvider.business_name}</p>
                  <p className="text-sm text-slate-600">{selectedProvider.address}, {selectedProvider.city}</p>
                </div>
                <div className="text-right">
                  <p className="text-sky-600 font-bold">${selectedProvider.price_per_lb}/lb</p>
                  {selectedProvider.distance_miles != null && (
                    <p className="text-sm text-slate-500">{selectedProvider.distance_miles} mi away</p>
                  )}
                </div>
              </div>
            )}

            {/* Pickup Time */}
            <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Schedule Pickup</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pickup_time">Pickup Time</Label>
                  <Input
                    data-testid="pickup-time-input"
                    id="pickup_time"
                    type="datetime-local"
                    value={formData.pickup_time}
                    onChange={(e) => setFormData({ ...formData, pickup_time: e.target.value })}
                    required
                    className="mt-2 rounded-xl h-12 bg-slate-50"
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Special Instructions (Optional)</Label>
                  <Textarea
                    data-testid="notes-input"
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="mt-2 rounded-xl bg-slate-50"
                    placeholder="Any special instructions..."
                    rows={2}
                  />
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-slate-900">Laundry Items</h2>
                <Button
                  data-testid="add-item-btn"
                  type="button"
                  onClick={addItem}
                  size="sm"
                  className="rounded-full"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Item
                </Button>
              </div>

              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={index} data-testid={`item-${index}`} className="flex gap-4 items-end">
                    <div className="flex-1">
                      <Label>Service</Label>
                      <Select
                        value={item.service_type}
                        onValueChange={(value) => updateItem(index, 'service_type', value)}
                      >
                        <SelectTrigger data-testid={`service-type-${index}`} className="mt-2 rounded-xl h-12 bg-slate-50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(selectedProvider?.services || ['Wash & Fold', 'Dry Cleaning', 'Ironing', 'Alterations']).map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-28">
                      <Label>Weight (lbs)</Label>
                      <Input
                        data-testid={`weight-${index}`}
                        type="number"
                        step="0.1"
                        value={item.weight}
                        onChange={(e) => updateItem(index, 'weight', e.target.value)}
                        required
                        className="mt-2 rounded-xl h-12 bg-slate-50"
                        placeholder="5.0"
                      />
                    </div>
                    <div className="w-28">
                      <Label>Price ($)</Label>
                      <Input
                        data-testid={`price-${index}`}
                        type="number"
                        step="0.01"
                        value={item.price}
                        readOnly
                        className="mt-2 rounded-xl h-12 bg-slate-100"
                        placeholder="0.00"
                      />
                    </div>
                    {items.length > 1 && (
                      <Button
                        data-testid={`remove-item-${index}`}
                        type="button"
                        onClick={() => removeItem(index)}
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Summary & Submit */}
            <div className="bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Total Amount</h3>
                <p data-testid="total-amount" className="text-4xl font-bold">${totalAmount.toFixed(2)}</p>
              </div>
              <Button
                data-testid="create-order-btn"
                type="submit"
                disabled={submitting}
                className="w-full rounded-full h-12 bg-white text-sky-600 hover:bg-slate-50 font-semibold"
              >
                {submitting ? 'Creating Order...' : 'Create Order & Proceed to Payment'}
              </Button>
            </div>

            {/* Back Button */}
            <div className="flex justify-start">
              <Button variant="outline" onClick={() => setStep(2)} className="rounded-full">
                <ChevronLeft className="w-4 h-4 mr-1" /> Back to Providers
              </Button>
            </div>
          </form>
        )}
      </div>
    </DashboardLayout>
  );
}
