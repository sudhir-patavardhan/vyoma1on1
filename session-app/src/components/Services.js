import React, { useEffect, useState } from "react";
import axios from "axios";

const Services = () => {
  const [services, setServices] = useState([]);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const response = await axios.get("https://sessions.red/services"); // Replace with your API endpoint
        setServices(response.data);
      } catch (err) {
        console.error("Error fetching services:", err);
      }
    };

    fetchServices();
  }, []);

  return (
    <div>
      <h2>Your Services</h2>
      {services.length > 0 ? (
        <ul>
          {services.map((service) => (
            <li key={service.service_id}>
              <strong>{service.subject}</strong> - {service.service_type}
            </li>
          ))}
        </ul>
      ) : (
        <p>No services available.</p>
      )}
    </div>
  );
};

export default Services;